/**
 * Ops CLI (docs/03 §10), part 2: mentor onboarding and schedule changes that
 * reduce capacity (time off, deactivation, weekly windows) with all-or-nothing
 * --reassign, and account deletion (A-14).
 * Mentors teach 19:00 to 23:00 IST (13:30Z to 17:30Z); clock Tue 20 Oct 00:00Z.
 */
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { type NestExpressApplication } from '@nestjs/platform-express';
import { type DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { describeCommandError } from '../src/modules/ops-cli/command-errors';
import { MentorAddCommand } from '../src/modules/ops-cli/mentors/mentor-add.command';
import { MentorAvailabilitySetCommand } from '../src/modules/ops-cli/mentors/mentor-availability-set.command';
import { MentorListCommand } from '../src/modules/ops-cli/mentors/mentor-list.command';
import { MentorTimeOffAddCommand } from '../src/modules/ops-cli/mentors/mentor-time-off-add.command';
import { MentorTimeOffRemoveCommand } from '../src/modules/ops-cli/mentors/mentor-time-off-remove.command';
import { MentorUpdateCommand } from '../src/modules/ops-cli/mentors/mentor-update.command';
import { UserAnonymiseCommand } from '../src/modules/ops-cli/users/user-anonymise.command';

import { addMentor, PASSWORD, type TestMentor, TestParent } from './support/booking-fixtures';
import { connectMigrated, createTestDatabase, single, type TestDatabase } from './support/database';
import { ManualClock } from './support/manual-clock';
import { api, createTestApp } from './support/test-app';
import { createTestCli, type TestCli } from './support/test-cli';

let database: TestDatabase;
let db: DataSource;
let app: NestExpressApplication;
let cli: TestCli;
const START = '2026-10-20T00:00:00Z';
/** Sat 24 Oct 21:30 IST. */
const SATURDAY = '2026-10-24T16:00:00Z';
/** Sat 24 Oct 19:30 IST. */
const SATURDAY_EARLY = '2026-10-24T14:00:00Z';
const clock = new ManualClock(START);

beforeAll(async () => {
  database = await createTestDatabase();
  db = await connectMigrated(database.url);
  app = await createTestApp({
    clock,
    env: { DATABASE_URL: database.url, RATE_LIMIT_MULTIPLIER: '100' },
  });
  cli = await createTestCli({ databaseUrl: database.url, clock });
});

afterAll(async () => {
  await cli.module.close();
  await app.close();
  await db.destroy();
  await database.drop();
});

beforeEach(async () => {
  clock.set(START);
  cli.output.clear();
  cli.prompt.answer = true;
  await db.query(
    'TRUNCATE users, mentors, outbox_messages, email_deliveries, waitlist_entries RESTART IDENTITY CASCADE',
  );
});

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

const timeOffAdd = () => cli.module.get(MentorTimeOffAddCommand);
const update = () => cli.module.get(MentorUpdateCommand);

async function mentorOf(bookingId: string): Promise<string> {
  return single(
    await db.query<{ mentor_id: string }[]>('SELECT mentor_id FROM bookings WHERE id = $1', [
      bookingId,
    ]),
  ).mentor_id;
}

async function referenceOf(bookingId: string): Promise<string> {
  return single(
    await db.query<{ reference: string }[]>('SELECT reference FROM bookings WHERE id = $1', [
      bookingId,
    ]),
  ).reference;
}

async function timeOffCount(): Promise<number> {
  return single(await db.query<{ n: number }[]>('SELECT count(*)::int AS n FROM mentor_time_off'))
    .n;
}

/** A booking on `mentor`: the other mentors are briefly inactive so assignment is forced. */
async function bookOn(
  mentor: TestMentor,
  others: readonly TestMentor[],
  parent: TestParent,
  slot: string,
) {
  const ids = others.map((other) => other.id);
  await db.query('UPDATE mentors SET is_active = false WHERE id = ANY($1)', [ids]);
  const booking = await parent.book(slot);
  await db.query('UPDATE mentors SET is_active = true WHERE id = ANY($1)', [ids]);
  expect(await mentorOf(booking.id)).toBe(mentor.id);
  return booking;
}

describe('mentor:add and mentor:list', () => {
  it('onboards a mentor and lists everyone with today’s load', async () => {
    expect(
      await run(cli.module.get(MentorAddCommand), [], {
        name: 'Meera Pillai',
        email: 'meera.pillai@example.com',
        tz: 'Asia/Calcutta',
        yes: true,
      }),
    ).toBeNull();
    expect(cli.output.text).toContain(
      'Next: mentor:availability:set meera.pillai@example.com --file availability.json',
    );
    expect(
      single(
        await db.query<unknown[]>('SELECT timezone, max_trials_per_day, is_active FROM mentors'),
      ),
    ).toEqual({ timezone: 'Asia/Kolkata', max_trials_per_day: 2, is_active: true });

    expect(
      await run(cli.module.get(MentorAddCommand), [], {
        name: 'Meera P',
        email: 'MEERA.PILLAI@example.com',
        tz: 'Asia/Kolkata',
        yes: true,
      }),
    ).toBe('A mentor with email meera.pillai@example.com already exists');

    cli.output.clear();
    await run(cli.module.get(MentorListCommand), []);
    expect(cli.output.lines[1]).toMatch(
      /^Meera Pillai\s+meera\.pillai@example\.com\s+Asia\/Kolkata\s+0\/2\s+0\s+yes$/,
    );
  });
});

describe('mentor:time-off:add', () => {
  it('refuses to strand a booked class unless --reassign, and changes nothing', async () => {
    const priya = await addMentor(db, 'Priya Raghavan');
    const karthik = await addMentor(db, 'Karthik Menon');
    const parent = await TestParent.signUp(app);
    const booking = await bookOn(priya, [karthik], parent, SATURDAY);
    const reference = await referenceOf(booking.id);

    const refusal = await run(timeOffAdd(), [priya.email], {
      from: '2026-10-24T00:00+05:30',
      to: '2026-10-25T00:00+05:30',
      reason: 'Sick',
      yes: true,
    });

    expect(refusal).toBe(
      'Re-run with --reassign to move them to other mentors, or cancel them first (booking:cancel).',
    );
    expect(cli.output.text).toContain(`${reference}  Sat 24 Oct, 21:30 Kolkata time (GMT+5:30)`);
    expect(await timeOffCount()).toBe(0);
    expect(await mentorOf(booking.id)).toBe(priya.id);
  });

  it('with --reassign moves the stranded classes and records the time off (sick day, E-25)', async () => {
    const priya = await addMentor(db, 'Priya Raghavan');
    const karthik = await addMentor(db, 'Karthik Menon');
    const parent = await TestParent.signUp(app);
    const booking = await bookOn(priya, [karthik], parent, SATURDAY);
    const untouched = await bookOn(priya, [karthik], parent, '2026-10-22T16:00:00Z');
    const reference = await referenceOf(booking.id);

    expect(
      await run(timeOffAdd(), [priya.email], {
        from: '2026-10-24T00:00+05:30',
        to: '2026-10-25T00:00+05:30',
        reason: 'Sick',
        reassign: true,
        yes: true,
      }),
    ).toBeNull();

    expect(cli.output.text).toContain(`Moved ${reference}.`);
    expect(await mentorOf(booking.id)).toBe(karthik.id);
    expect(await mentorOf(untouched.id)).toBe(priya.id);
    expect(await timeOffCount()).toBe(1);
    expect(
      await db.query<{ type: string }[]>(
        `SELECT type FROM outbox_messages WHERE type = 'BookingReassigned'`,
      ),
    ).toHaveLength(1);
    // Priya is no longer offered on Saturday.
    const slots = await api(app)
      .get('/api/v1/availability/slots?from=2026-10-24&days=1&tz=Asia/Kolkata')
      .expect(200);
    expect(JSON.stringify(slots.body)).not.toContain(priya.id);
  });

  it('is all or nothing: one class without cover leaves everything as it was', async () => {
    const priya = await addMentor(db, 'Priya Raghavan');
    const karthik = await addMentor(db, 'Karthik Menon');
    const parent = await TestParent.signUp(app);
    const early = await bookOn(priya, [karthik], parent, SATURDAY_EARLY);
    const late = await bookOn(priya, [karthik], parent, SATURDAY);
    // Karthik can cover the early class only.
    await db.query(
      `INSERT INTO mentor_time_off (mentor_id, starts_at, ends_at) VALUES ($1, $2, $3)`,
      [karthik.id, '2026-10-24T15:30:00Z', '2026-10-24T18:00:00Z'],
    );

    const refusal = await run(timeOffAdd(), [priya.email], {
      from: '2026-10-24T00:00+05:30',
      to: '2026-10-25T00:00+05:30',
      reassign: true,
      yes: true,
    });

    expect(refusal).toBe(
      `No other mentor is free for ${await referenceOf(late.id)}; nothing was changed. ` +
        'Cancel those first: booking:cancel <reference> --reason "<why>"',
    );
    expect(await mentorOf(early.id)).toBe(priya.id);
    expect(await mentorOf(late.id)).toBe(priya.id);
    expect(await timeOffCount()).toBe(1);
    expect(
      await db.query<unknown[]>(`SELECT 1 FROM outbox_messages WHERE type = 'BookingReassigned'`),
    ).toEqual([]);
  });

  it('names every class without cover, not just the first (FR-O3)', async () => {
    const priya = await addMentor(db, 'Priya Raghavan');
    const parent = await TestParent.signUp(app);
    const early = await parent.book(SATURDAY_EARLY);
    const late = await parent.book(SATURDAY);

    const refusal = await run(timeOffAdd(), [priya.email], {
      from: '2026-10-24T00:00+05:30',
      to: '2026-10-25T00:00+05:30',
      reassign: true,
      yes: true,
    });

    const references = [await referenceOf(early.id), await referenceOf(late.id)];
    expect(refusal).toContain(`No other mentor is free for ${references.join(', ')};`);
    expect(await timeOffCount()).toBe(0);
  });

  it('never ends with a booked class inside new time off when a parent books at the same moment', async () => {
    const priya = await addMentor(db, 'Priya Raghavan');
    const parent = await TestParent.signUp(app);
    const studentId = await parent.child('Leo');

    const [refusal, booking] = await Promise.all([
      run(timeOffAdd(), [priya.email], {
        from: '2026-10-24T00:00+05:30',
        to: '2026-10-25T00:00+05:30',
        yes: true,
      }),
      parent.post(
        '/bookings',
        { slotStart: SATURDAY, timezone: 'Europe/London', student: { id: studentId } },
        randomUUID(),
      ),
    ]);

    const confirmed = await db.query<unknown[]>(
      `SELECT 1 FROM bookings WHERE status = 'CONFIRMED'`,
    );
    const timeOff = await timeOffCount();
    // Exactly one of the two won, whichever took the mentor lock first.
    expect(confirmed.length + timeOff).toBe(1);
    expect(booking.status === 201).toBe(confirmed.length === 1);
    expect(refusal === null).toBe(timeOff === 1);
  });

  it('validates the period', async () => {
    const priya = await addMentor(db, 'Priya Raghavan');

    expect(
      await run(timeOffAdd(), [priya.email], { from: '2026-10-24', to: '2026-10-25', yes: true }),
    ).toBe('--from must be a date and time with an offset, e.g. 2026-10-24T00:00+05:30');
    expect(
      await run(timeOffAdd(), [priya.email], {
        from: '2026-10-25T00:00Z',
        to: '2026-10-24T00:00Z',
        yes: true,
      }),
    ).toBe('--to must be after --from');
    expect(
      await run(timeOffAdd(), ['nobody@example.com'], {
        from: '2026-10-24T00:00Z',
        to: '2026-10-25T00:00Z',
        yes: true,
      }),
    ).toBe('No mentor with email nobody@example.com');
  });

  it('removes a time off period', async () => {
    const priya = await addMentor(db, 'Priya Raghavan');
    await run(timeOffAdd(), [priya.email], {
      from: '2026-10-24T00:00+05:30',
      to: '2026-10-25T00:00+05:30',
      yes: true,
    });
    const { id } = single(await db.query<{ id: string }[]>('SELECT id FROM mentor_time_off'));
    expect(cli.output.text).toContain(`Added time off ${id}.`);

    expect(await run(cli.module.get(MentorTimeOffRemoveCommand), [id], { yes: true })).toBeNull();
    expect(await timeOffCount()).toBe(0);
    expect(await run(cli.module.get(MentorTimeOffRemoveCommand), [id], { yes: true })).toBe(
      `No time off with id "${id}"`,
    );
  });
});

describe('mentor:update', () => {
  it('deactivating needs --reassign when classes are booked, then moves them all', async () => {
    const priya = await addMentor(db, 'Priya Raghavan');
    const karthik = await addMentor(db, 'Karthik Menon');
    const parent = await TestParent.signUp(app);
    const first = await bookOn(priya, [karthik], parent, SATURDAY);
    const second = await bookOn(priya, [karthik], parent, '2026-10-22T16:00:00Z');

    expect(await run(update(), [priya.email], { active: false, yes: true })).toMatch(/--reassign/);
    expect(
      single(await db.query<unknown[]>('SELECT is_active FROM mentors WHERE id = $1', [priya.id])),
    ).toEqual({ is_active: true });

    expect(
      await run(update(), [priya.email], { active: false, reassign: true, yes: true }),
    ).toBeNull();

    expect(await mentorOf(first.id)).toBe(karthik.id);
    expect(await mentorOf(second.id)).toBe(karthik.id);
    expect(
      single(await db.query<unknown[]>('SELECT is_active FROM mentors WHERE id = $1', [priya.id])),
    ).toEqual({ is_active: false });
  });

  it('changes the cap for future bookings without moving anything', async () => {
    const priya = await addMentor(db, 'Priya Raghavan');
    const parent = await TestParent.signUp(app);
    await parent.book(SATURDAY);
    await parent.book(SATURDAY_EARLY);

    expect(await run(update(), [priya.email], { cap: 1, yes: true })).toBeNull();

    expect(
      single(
        await db.query<unknown[]>('SELECT max_trials_per_day FROM mentors WHERE id = $1', [
          priya.id,
        ]),
      ),
    ).toEqual({ max_trials_per_day: 1 });
    expect(await run(update(), [priya.email], { yes: true })).toBe(
      'Nothing to change: give --cap, --tz or --active',
    );
  });
});

describe('mentor:availability:set', () => {
  async function windowsFile(windows: object): Promise<string> {
    const path = join(tmpdir(), `availability-${randomUUID()}.json`);
    await writeFile(path, JSON.stringify(windows));
    return path;
  }

  it('previews in IST, New York and London, then replaces the windows from a date', async () => {
    const priya = await addMentor(db, 'Priya Raghavan');
    const file = await windowsFile([
      { weekday: 'Sat', start: '18:00', end: '22:00' },
      { weekday: 7, start: '22:00', end: '01:00' },
    ]);

    expect(
      await run(cli.module.get(MentorAvailabilitySetCommand), [priya.email], {
        file,
        from: '2026-10-24',
        yes: true,
      }),
    ).toBeNull();

    expect(cli.output.text).toContain(
      'Sat 2026-10-24  18:00 to 22:00 Kolkata time (GMT+5:30)  08:30 to 12:30 Eastern Time (GMT-4)  13:30 to 17:30 London time (GMT+1)',
    );
    // London falls back on Sunday 25 October.
    expect(cli.output.text).toContain('16:30 to 19:30 London time (GMT)');
    const rules = await db.query<
      { weekday: number; effective_from: string; effective_to: string | null }[]
    >(
      `SELECT weekday, effective_from, effective_to FROM mentor_availability_rules
        WHERE mentor_id = $1 ORDER BY effective_from, weekday`,
      [priya.id],
    );
    expect(rules).toHaveLength(9);
    expect(rules.filter((rule) => rule.effective_to === '2026-10-23')).toHaveLength(7);
    expect(rules.filter((rule) => rule.effective_from === '2026-10-24')).toEqual([
      { weekday: 6, effective_from: '2026-10-24', effective_to: null },
      { weekday: 7, effective_from: '2026-10-24', effective_to: null },
    ]);
  });

  it('refuses windows that no longer hold a booked class', async () => {
    const priya = await addMentor(db, 'Priya Raghavan');
    const parent = await TestParent.signUp(app);
    const booking = await parent.book(SATURDAY);
    const file = await windowsFile([{ weekday: 'Sat', start: '18:00', end: '20:30' }]);

    const refusal = await run(cli.module.get(MentorAvailabilitySetCommand), [priya.email], {
      file,
      from: '2026-10-21',
      yes: true,
    });

    expect(refusal).toMatch(/cancel them first/);
    expect(cli.output.text).toContain(await referenceOf(booking.id));
    expect(
      await db.query<unknown[]>(
        'SELECT 1 FROM mentor_availability_rules WHERE effective_to IS NOT NULL',
      ),
    ).toEqual([]);
  });

  it('explains what is wrong with the file', async () => {
    const priya = await addMentor(db, 'Priya Raghavan');
    const file = await windowsFile([{ weekday: 'Funday', start: '7pm', end: '19:00' }]);

    const refusal = await run(cli.module.get(MentorAvailabilitySetCommand), [priya.email], {
      file,
      yes: true,
    });

    expect(refusal).toContain('--file: invalid availability');
    expect(refusal).toContain('0.weekday');
    expect(refusal).toContain('0.start: use HH:MM, 24-hour');
  });
});

describe('user:anonymise (A-14)', () => {
  it('waits for upcoming classes, then removes every personal detail and keeps the bookings', async () => {
    await addMentor(db, 'Priya Raghavan');
    const parent = await TestParent.signUp(app);
    const booking = await parent.book(SATURDAY);
    await api(app)
      .post('/api/v1/waitlist')
      .send({ fullName: 'Hannah Okafor', email: parent.email, timezone: 'Europe/London' })
      .expect(201);
    const reference = await referenceOf(booking.id);
    const anonymise = cli.module.get(UserAnonymiseCommand);

    expect(await run(anonymise, [parent.email], { yes: true })).toBe(
      `The account has upcoming classes: ${reference}. Cancel them first (booking:cancel), ` +
        'let the worker send the emails, then re-run.',
    );

    await parent.post(`/bookings/${booking.id}/cancel`).expect(200);
    await db.query(
      `INSERT INTO email_deliveries (outbox_message_id, template, recipient_email, recipient_timezone, sent_at)
       SELECT id, 'booking-cancelled-parent', $1, 'Europe/London', now() FROM outbox_messages LIMIT 1`,
      [parent.email],
    );
    expect(await run(anonymise, [parent.email], { yes: true })).toBeNull();
    expect(cli.output.text).toContain(
      `Account ${parent.email}: Hannah Okafor, 1 child, 1 booking (kept, without personal details).`,
    );
    expect(cli.output.text).toContain('removed 1 waitlist entry, cancelled 0 unsent emails.');

    const [user] = await db.query<{ id: string; email: string; full_name: string; phone: null }[]>(
      'SELECT id, email, full_name, phone FROM users',
    );
    expect(user).toEqual({
      id: user?.id,
      email: `deleted-${user?.id ?? ''}@deleted.invalid`,
      full_name: 'Deleted account',
      phone: null,
    });
    expect(await db.query<unknown[]>('SELECT first_name FROM students')).toEqual([
      { first_name: 'Child 1' },
    ]);
    expect(await db.query<unknown[]>('SELECT 1 FROM auth_sessions')).toEqual([]);
    expect(await db.query<unknown[]>('SELECT 1 FROM waitlist_entries')).toEqual([]);
    expect(await db.query<unknown[]>('SELECT recipient_email FROM email_deliveries')).toEqual([
      { recipient_email: user?.email },
    ]);
    expect(await db.query<unknown[]>('SELECT status FROM bookings')).toEqual([
      { status: 'CANCELLED' },
    ]);
    await api(app)
      .post('/api/v1/auth/login')
      .send({ email: parent.email, password: PASSWORD })
      .expect(401);
    expect(await run(anonymise, [parent.email], { yes: true })).toBe(
      `No account with email ${parent.email}`,
    );
  });
});
