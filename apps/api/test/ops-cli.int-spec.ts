/**
 * Ops CLI (docs/03 §10), part 1: the "mentor is sick" flow (E-25) end to end
 * with its emails, booking list, outbox and waitlist follow-up.
 * Mentors teach 19:00 to 23:00 IST (13:30Z to 17:30Z); clock Tue 20 Oct 00:00Z.
 */
import { randomUUID } from 'node:crypto';

import { type NestExpressApplication } from '@nestjs/platform-express';
import { type TestingModule } from '@nestjs/testing';
import { type DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { OutboxRelay } from '../src/modules/notifications/application/outbox-relay';
import { BookingCancelCommand } from '../src/modules/ops-cli/bookings/booking-cancel.command';
import { BookingListCommand } from '../src/modules/ops-cli/bookings/booking-list.command';
import { BookingReassignCommand } from '../src/modules/ops-cli/bookings/booking-reassign.command';
import { describeCommandError } from '../src/modules/ops-cli/command-errors';
import { OutboxListCommand } from '../src/modules/ops-cli/outbox/outbox-list.command';
import { OutboxRetryCommand } from '../src/modules/ops-cli/outbox/outbox-retry.command';
import { WaitlistListCommand } from '../src/modules/ops-cli/waitlist/waitlist-list.command';
import { WaitlistMarkCommand } from '../src/modules/ops-cli/waitlist/waitlist-mark.command';

import { addMentor, TestParent } from './support/booking-fixtures';
import { connectMigrated, createTestDatabase, single, type TestDatabase } from './support/database';
import { waitForMails } from './support/mailpit';
import { ManualClock } from './support/manual-clock';
import { api, createTestApp } from './support/test-app';
import { createTestCli, type TestCli } from './support/test-cli';
import { createTestWorker } from './support/test-worker';

let database: TestDatabase;
let db: DataSource;
let app: NestExpressApplication;
let worker: TestingModule;
let relay: OutboxRelay;
let cli: TestCli;
const START = '2026-10-20T00:00:00Z';
/** Sat 24 Oct: 9:30 PM in Kolkata, 5:00 PM in London. */
const SATURDAY = '2026-10-24T16:00:00Z';
const clock = new ManualClock(START);

beforeAll(async () => {
  database = await createTestDatabase();
  db = await connectMigrated(database.url);
  const env = { DATABASE_URL: database.url, RATE_LIMIT_MULTIPLIER: '100' };
  app = await createTestApp({ clock, env });
  worker = await createTestWorker({ clock, env });
  relay = worker.get(OutboxRelay);
  cli = await createTestCli({ databaseUrl: database.url, clock });
});

afterAll(async () => {
  await cli.module.close();
  await worker.close();
  await app.close();
  await db.destroy();
  await database.drop();
});

beforeEach(async () => {
  clock.set(START);
  cli.output.clear();
  cli.prompt.answer = true;
  cli.prompt.questions = [];
  await db.query(
    'TRUNCATE users, mentors, outbox_messages, email_deliveries, waitlist_entries RESTART IDENTITY CASCADE',
  );
});

/** Runs a command like the CLI does: a refusal becomes the message the operator reads. */
async function run(
  command: { run(args: string[], options?: object): Promise<void> },
  args: string[],
  options: object = {},
): Promise<string | null> {
  try {
    await command.run(args, options);
    return null;
  } catch (error) {
    return describeCommandError(error as Error);
  }
}

const reassign = () => cli.module.get(BookingReassignCommand);
const cancel = () => cli.module.get(BookingCancelCommand);

interface BookingRow {
  mentor_id: string;
  status: string;
  ics_sequence: number;
  mentor_join_token: string;
  cancelled_by: string | null;
  cancel_reason: string | null;
}

async function bookingRow(id: string): Promise<BookingRow> {
  return single(
    await db.query<BookingRow[]>(
      `SELECT mentor_id, status, ics_sequence, mentor_join_token, cancelled_by, cancel_reason
         FROM bookings WHERE id = $1`,
      [id],
    ),
  );
}

async function lastEvent(bookingId: string) {
  return single(
    await db.query<{ type: string; actor: string; payload: Record<string, unknown> }[]>(
      `SELECT type, actor, payload FROM booking_events WHERE booking_id = $1 ORDER BY id DESC LIMIT 1`,
      [bookingId],
    ),
  );
}

async function referenceOf(id: string): Promise<string> {
  return single(
    await db.query<{ reference: string }[]>('SELECT reference FROM bookings WHERE id = $1', [id]),
  ).reference;
}

describe('the mentor is sick (E-25)', () => {
  it('reassigns a class on the day to another free mentor and emails everyone', async () => {
    const mentors = [await addMentor(db, 'Priya Raghavan'), await addMentor(db, 'Karthik Menon')];
    const parent = await TestParent.signUp(app);
    const booking = await parent.book(SATURDAY);
    await relay.runBatch();
    const before = await bookingRow(booking.id);
    const sick = mentors.find((mentor) => mentor.id === before.mentor_id);
    const cover = mentors.find((mentor) => mentor.id !== before.mentor_id);
    const reference = await referenceOf(booking.id);
    // Two hours before the class: well inside the parents' 4-hour lead time.
    clock.set('2026-10-24T14:00:00Z');
    await relay.runBatch(); // the 24-hour reminders

    expect(await run(reassign(), [reference.toLowerCase()], { yes: true })).toBeNull();

    expect(cli.output.text).toContain(`Booking ${reference} (CONFIRMED)`);
    expect(cli.output.text).toContain(`Reassigned ${reference} to ${cover?.fullName ?? ''}.`);
    const after = await bookingRow(booking.id);
    expect(after).toMatchObject({ mentor_id: cover?.id, status: 'CONFIRMED', ics_sequence: 1 });
    expect(after.mentor_join_token).not.toBe(before.mentor_join_token);
    const event = await lastEvent(booking.id);
    expect(event).toMatchObject({
      type: 'REASSIGNED',
      payload: { fromMentorId: sick?.id, toMentorId: cover?.id },
    });
    expect(event.actor).toMatch(/^ops:.+/);

    expect((await relay.runBatch()).done).toBe(1);
    const [, , update] = await waitForMails(parent.email, 3);
    expect(update?.Subject).toBe("New mentor for Leo's trial class on Saturday 24 October");
    const [, , movedAway] = await waitForMails(sick?.email ?? '', 3);
    expect(movedAway?.Text).toContain('Our team moved the trial class with Leo to another mentor.');
    const [welcome] = await waitForMails(cover?.email ?? '', 1);
    expect(welcome?.Text).toContain(`/class/${after.mentor_join_token}`);

    await api(app).get(`/api/v1/classroom/${before.mentor_join_token}`).expect(404);
    await api(app).get(`/api/v1/classroom/${after.mentor_join_token}`).expect(200);
  });

  it('says when nobody else is free; ops then cancels with an apology to the family', async () => {
    await addMentor(db, 'Priya Raghavan');
    const parent = await TestParent.signUp(app);
    const booking = await parent.book(SATURDAY);
    await relay.runBatch();
    const reference = await referenceOf(booking.id);

    expect(await run(reassign(), [reference], { yes: true })).toBeNull();
    expect(cli.output.errors).toEqual([
      `No other mentor is free for ${reference}. Cancel it with: booking:cancel ${reference} --reason "<why>"`,
    ]);
    expect(await bookingRow(booking.id)).toMatchObject({ status: 'CONFIRMED', ics_sequence: 0 });

    expect(
      await run(cancel(), [reference], { reason: 'Mentor ill, no cover', yes: true }),
    ).toBeNull();

    expect(await bookingRow(booking.id)).toMatchObject({
      status: 'CANCELLED',
      cancelled_by: 'OPS',
      cancel_reason: 'Mentor ill, no cover',
      ics_sequence: 1,
    });
    expect((await lastEvent(booking.id)).actor).toMatch(/^ops:/);
    await relay.runBatch();
    const [, apology] = await waitForMails(parent.email, 2);
    expect(apology?.Text).toContain("We are sorry: we had to cancel Leo's trial class with Priya.");
    expect(apology?.Text).toContain('Book another time: http://localhost:5173/book');
    expect(apology?.Text).not.toContain('Mentor ill');
  });

  it('never lets a reassign and a new booking take the same mentor at the same time', async () => {
    const mentors = [await addMentor(db, 'Priya Raghavan'), await addMentor(db, 'Karthik Menon')];
    const first = await TestParent.signUp(app);
    const booking = await first.book(SATURDAY);
    const reference = await referenceOf(booking.id);
    const second = await TestParent.signUp(app);
    const studentId = await second.child('Maya');

    const [, secondBooking] = await Promise.all([
      run(reassign(), [reference], { yes: true }),
      second.post(
        '/bookings',
        { slotStart: SATURDAY, timezone: 'Europe/London', student: { id: studentId } },
        randomUUID(),
      ),
    ]);

    expect([201, 409]).toContain(secondBooking.status);
    const confirmed = await db.query<{ mentor_id: string }[]>(
      `SELECT mentor_id FROM bookings WHERE status = 'CONFIRMED' AND starts_at = $1`,
      [SATURDAY],
    );
    expect(confirmed).toHaveLength(secondBooking.status === 201 ? 2 : 1);
    expect(new Set(confirmed.map((row) => row.mentor_id)).size).toBe(confirmed.length);
    expect(mentors.map((mentor) => mentor.id)).toEqual(
      expect.arrayContaining(confirmed.map((row) => row.mentor_id)),
    );
  });

  it('refuses unknown, finished or unconfirmed bookings and changes nothing on "no"', async () => {
    await addMentor(db, 'Priya Raghavan');
    await addMentor(db, 'Karthik Menon');
    const parent = await TestParent.signUp(app);
    const booking = await parent.book(SATURDAY);
    const reference = await referenceOf(booking.id);

    expect(await run(reassign(), ['CY-NOPE1'], { yes: true })).toBe('Booking not found');
    expect(await run(cancel(), [reference], { yes: true })).toBe(
      '--reason is required, e.g. --reason "Mentor ill"',
    );

    cli.prompt.answer = false;
    expect(await run(reassign(), [reference])).toBeNull();
    expect(await run(cancel(), [reference], { reason: 'Test' })).toBeNull();
    expect(cli.output.lines.filter((line) => line === 'Nothing changed.')).toHaveLength(2);
    expect(await bookingRow(booking.id)).toMatchObject({ status: 'CONFIRMED', ics_sequence: 0 });

    clock.set('2026-10-24T16:00:00Z');
    expect(await run(reassign(), [reference], { yes: true })).toBe(
      `This booking can no longer be changed: Booking ${reference} has already started.`,
    );
  });
});

describe('booking:list', () => {
  it('lists the day in mentor time with the family time alongside', async () => {
    const priya = await addMentor(db, 'Priya Raghavan');
    await addMentor(db, 'Karthik Menon');
    const parent = await TestParent.signUp(app);
    const booking = await parent.book(SATURDAY);
    const reference = await referenceOf(booking.id);

    await run(cli.module.get(BookingListCommand), [], { from: '2026-10-24' });

    expect(cli.output.lines[0]).toBe(
      'Bookings 2026-10-24 to 2026-10-24, times in Kolkata time (GMT+5:30):',
    );
    const row = cli.output.lines.find((line) => line.startsWith(reference));
    expect(row).toContain('CONFIRMED');
    expect(row).toContain('Sat 24 Oct, 21:30');
    expect(row).toContain('Sat 24 Oct, 17:00 London time (GMT+1)');
    expect(row).toContain(`Hannah Okafor <${parent.email}>`);

    cli.output.clear();
    await run(cli.module.get(BookingListCommand), [], {
      from: '2026-10-24',
      mentor: priya.email,
      status: 'cancelled',
    });
    expect(cli.output.lines.at(-1)).toBe('(none)');

    expect(await run(cli.module.get(BookingListCommand), [], { from: '24/10/2026' })).toBe(
      '--from must be a date like 2026-10-24',
    );
  });
});

describe('outbox and waitlist follow-up', () => {
  it('lists DEAD messages and queues them again', async () => {
    await db.query(
      `INSERT INTO outbox_messages (type, payload, status, attempts, last_error) VALUES
         ('BookingConfirmed', '{}', 'DEAD', 8, 'Error: 550 Mailbox unavailable: p***@example.com'),
         ('BookingCancelled', '{}', 'DEAD', 8, 'Error: timeout'),
         ('PasswordChanged', '{}', 'DONE', 1, NULL)`,
    );

    await run(cli.module.get(OutboxListCommand), [], {});
    expect(cli.output.lines).toHaveLength(3);
    expect(cli.output.text).toContain('550 Mailbox unavailable');

    expect(await run(cli.module.get(OutboxRetryCommand), ['1'], { yes: true })).toBeNull();
    expect(await run(cli.module.get(OutboxRetryCommand), ['3'], { yes: true })).toBeNull();
    expect(cli.output.errors).toEqual(['Message 3 is not DEAD.']);
    expect(await run(cli.module.get(OutboxRetryCommand), [], { allDead: true, yes: true })).toBe(
      null,
    );
    expect(cli.output.lines).toContain('Queued again: 2.');

    const rows = await db.query<{ status: string; attempts: number }[]>(
      'SELECT status, attempts FROM outbox_messages ORDER BY id',
    );
    expect(rows).toEqual([
      { status: 'PENDING', attempts: 0 },
      { status: 'PENDING', attempts: 0 },
      { status: 'DONE', attempts: 1 },
    ]);
    expect(await run(cli.module.get(OutboxRetryCommand), [], { yes: true })).toBe(
      'Give one message id or --all-dead',
    );
  });

  it('lists open waitlist entries and records the follow-up', async () => {
    await api(app)
      .post('/api/v1/waitlist')
      .send({
        fullName: 'Priya Shah',
        email: 'priya.shah@example.com',
        timezone: 'America/New_York',
        preferredTimes: 'Weekends',
      })
      .expect(201);
    const { id } = single(await db.query<{ id: string }[]>('SELECT id FROM waitlist_entries'));

    await run(cli.module.get(WaitlistListCommand), [], {});
    expect(cli.output.lines[1]).toContain('priya.shah@example.com');
    expect(cli.output.lines[1]).toContain('America/New_York');

    expect(await run(cli.module.get(WaitlistMarkCommand), [id, 'contacted'], { yes: true })).toBe(
      null,
    );
    cli.output.clear();
    await run(cli.module.get(WaitlistListCommand), [], {});
    expect(cli.output.lines).toEqual(['(none)']);
    cli.output.clear();
    await run(cli.module.get(WaitlistListCommand), [], { status: 'all' });
    expect(cli.output.lines[1]).toContain('CONTACTED');

    expect(await run(cli.module.get(WaitlistMarkCommand), [id, 'OPEN'], { yes: true })).toBe(
      'Status must be CONTACTED or CLOSED',
    );
  });
});
