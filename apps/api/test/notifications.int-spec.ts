/**
 * The worker (docs/03 §7, ADR 0005): outbox relay with dedupe, backoff, dead
 * letters and the reaper; every email checked in Mailpit with times in the
 * recipient's zone (FR-N1 to FR-N4, E-17); completion and credential cleanup.
 * Mentors teach 19:00 to 23:00 IST (13:30Z to 17:30Z); clock Tue 20 Oct 00:00Z.
 */
import { type NestExpressApplication } from '@nestjs/platform-express';
import { type TestingModule } from '@nestjs/testing';
import { type DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { StudentSchema } from '@app/contracts';

import { CredentialCleanupService } from '../src/modules/auth/application/credential-cleanup.service';
import { CompleteBookingsService } from '../src/modules/bookings/application/complete-bookings.service';
import { OutboxRelay } from '../src/modules/notifications/application/outbox-relay';
import { MailTransport, type OutgoingMail } from '../src/modules/notifications/mail/mail-transport';

import { addMentor, PASSWORD, TestParent } from './support/booking-fixtures';
import { connectMigrated, createTestDatabase, single, type TestDatabase } from './support/database';
import { calendarsOf, mailsTo, waitForMails } from './support/mailpit';
import { ManualClock } from './support/manual-clock';
import { api, createTestApp } from './support/test-app';
import { createTestWorker } from './support/test-worker';

/** Real SMTP to Mailpit, failing on demand for chosen recipients. */
class FlakyTransport extends MailTransport {
  failFor: ((mail: OutgoingMail) => boolean) | null = null;

  constructor(private readonly smtp: MailTransport) {
    super();
  }

  send(mail: OutgoingMail): Promise<{ messageId: string }> {
    if (this.failFor?.(mail) === true) {
      return Promise.reject(new Error(`550 Mailbox unavailable: ${mail.to.email}`));
    }
    return this.smtp.send(mail);
  }
}

let database: TestDatabase;
let db: DataSource;
let app: NestExpressApplication;
let worker: TestingModule;
let relay: OutboxRelay;
let transport: FlakyTransport;
const START = '2026-10-20T00:00:00Z';
/** Sat 24 Oct: 5:00 PM in London (BST), 9:30 PM in Kolkata. */
const SATURDAY = '2026-10-24T16:00:00Z';
const clock = new ManualClock(START);

beforeAll(async () => {
  database = await createTestDatabase();
  db = await connectMigrated(database.url);
  const env = { DATABASE_URL: database.url, RATE_LIMIT_MULTIPLIER: '100' };
  app = await createTestApp({ clock, env });
  worker = await createTestWorker({
    clock,
    env,
    transport: (smtp) => (transport = new FlakyTransport(smtp)),
  });
  relay = worker.get(OutboxRelay);
});

afterAll(async () => {
  await worker.close();
  await app.close();
  await db.destroy();
  await database.drop();
});

beforeEach(async () => {
  clock.set(START);
  transport.failFor = null;
  await db.query(
    'TRUNCATE users, mentors, outbox_messages, email_deliveries RESTART IDENTITY CASCADE',
  );
});

interface OutboxRow {
  id: string;
  type: string;
  status: string;
  attempts: number;
  run_after: Date;
  last_error: string | null;
  payload: Record<string, unknown>;
}

async function outbox(type: string): Promise<OutboxRow[]> {
  return await db.query(
    `SELECT id, type, status, attempts, run_after, last_error, payload
       FROM outbox_messages WHERE type = $1 ORDER BY id`,
    [type],
  );
}

describe('booking emails', () => {
  it('emails parent and mentor once each, in their own zones, with a calendar invite', async () => {
    const mentor = await addMentor(db, 'Priya Raghavan');
    const parent = await TestParent.signUp(app);
    const booking = await parent.book(SATURDAY);

    expect(await relay.runBatch()).toEqual({ claimed: 1, done: 1, retried: 0, dead: 0 });

    const [toParent] = await waitForMails(parent.email, 1);
    expect(toParent?.Subject).toBe("Booked: Leo's trial class on Saturday 24 October");
    expect(toParent?.Text).toContain(
      'When: Saturday, 24 October 2026, 5:00 to 6:00 PM London time (GMT+1)',
    );
    expect(toParent?.Text).toContain(booking.joinUrl);
    expect(toParent?.HTML).toContain(`href="${booking.joinUrl}"`);
    const [invite] = await calendarsOf(toParent);
    expect(invite).toContain('METHOD:REQUEST');
    expect(invite).toContain(`UID:${booking.id}@codeyoung`);
    expect(invite).toContain('DTSTART:20261024T160000Z');
    expect(invite).toContain('SEQUENCE:0');
    expect(invite?.toLowerCase()).toContain(`mailto:${parent.email}`);

    const [toMentor] = await waitForMails(mentor.email, 1);
    expect(toMentor?.Subject).toBe('New trial class with Leo on Saturday 24 October');
    expect(toMentor?.Text).toContain(
      'When: Saturday, 24 October 2026, 9:30 to 10:30 PM Kolkata time (GMT+5:30)',
    );
    expect(toMentor?.Text).toContain('For the family it is 5:00 to 6:00 PM London time (GMT+1).');
    expect(toMentor?.Text).not.toContain(booking.joinUrl);

    expect(single(await outbox('BookingConfirmed'))).toMatchObject({ status: 'DONE', attempts: 1 });
    const deliveries = await db.query(
      `SELECT template, recipient_timezone, booking_id FROM email_deliveries
        WHERE sent_at IS NOT NULL ORDER BY template`,
    );
    expect(deliveries).toEqual([
      {
        template: 'booking-confirmed-mentor',
        recipient_timezone: 'Asia/Kolkata',
        booking_id: booking.id,
      },
      {
        template: 'booking-confirmed-parent',
        recipient_timezone: 'Europe/London',
        booking_id: booking.id,
      },
    ]);

    expect((await relay.runBatch()).claimed).toBe(0);
  });

  it('cancels both calendar events with a higher sequence and skips the reminders (E-12, E-17)', async () => {
    const mentor = await addMentor(db, 'Priya Raghavan');
    const parent = await TestParent.signUp(app);
    const booking = await parent.book(SATURDAY);
    await relay.runBatch();
    await parent.post(`/bookings/${booking.id}/cancel`, { reason: 'SCHEDULE_CHANGED' }).expect(200);

    await relay.runBatch();

    const [, cancelled] = await waitForMails(parent.email, 2);
    expect(cancelled?.Subject).toBe("Cancelled: Leo's trial class on Saturday 24 October");
    expect(cancelled?.Text).toContain("As you asked, we cancelled Leo's trial class with Priya.");
    const [cancellation] = await calendarsOf(cancelled);
    expect(cancellation).toContain('METHOD:CANCEL');
    expect(cancellation).toContain(`UID:${booking.id}@codeyoung`);
    expect(cancellation).toContain('SEQUENCE:1');
    const [, mentorCancelled] = await waitForMails(mentor.email, 2);
    expect(mentorCancelled?.Subject).toBe('Cancelled: trial class with Leo on Saturday 24 October');

    // Both reminders come due and go out as nothing.
    clock.set('2026-10-24T15:00:00Z');
    expect(await relay.runBatch()).toMatchObject({ claimed: 2, done: 2 });
    expect(await mailsTo(parent.email)).toHaveLength(2);
    expect((await outbox('BookingReminder')).map((row) => row.status)).toEqual(['DONE', 'DONE']);
  });

  it('reminds both sides 24 hours and 1 hour before, naming the day in each zone', async () => {
    const mentor = await addMentor(db, 'Priya Raghavan');
    const parent = await TestParent.signUp(app);
    await parent.book(SATURDAY);
    await relay.runBatch();

    clock.set('2026-10-23T16:00:00Z');
    expect((await relay.runBatch()).done).toBe(1);
    clock.set('2026-10-24T15:00:00Z');
    expect((await relay.runBatch()).done).toBe(1);

    const [, dayBefore, hourBefore] = await waitForMails(parent.email, 3);
    expect(dayBefore?.Subject).toBe(
      "Reminder: Leo's trial class is tomorrow at 5:00 PM London time (GMT+1)",
    );
    expect(hourBefore?.Subject).toBe(
      "Reminder: Leo's trial class is today at 5:00 PM London time (GMT+1)",
    );
    const [, mentorDayBefore] = await waitForMails(mentor.email, 3);
    expect(mentorDayBefore?.Subject).toBe(
      'Reminder: trial class with Leo tomorrow at 9:30 PM Kolkata time (GMT+5:30)',
    );
  });

  it('on reschedule: new time and old-event cancellation to the parent, both mentors told', async () => {
    const mentors = [await addMentor(db, 'Priya Raghavan'), await addMentor(db, 'Karthik Menon')];
    const parent = await TestParent.signUp(app);
    const original = await parent.book(SATURDAY);
    await relay.runBatch();
    // Sunday 25 Oct: London is back on GMT, so the same 16:00Z is now 4:00 PM.
    const moved = await parent.reschedule(original.id, '2026-10-25T16:00:00Z');

    expect((await relay.runBatch()).done).toBe(1);

    const [, rescheduled] = await waitForMails(parent.email, 2);
    expect(rescheduled?.Subject).toBe("New time for Leo's trial class: Sunday 25 October");
    expect(rescheduled?.Text).toContain(
      'New time: Sunday, 25 October 2026, 4:00 to 5:00 PM London time (GMT)',
    );
    expect(rescheduled?.Text).toContain(
      'Before: Saturday, 24 October 2026, 5:00 to 6:00 PM London time (GMT+1)',
    );
    expect(rescheduled?.Text).toContain(moved.joinUrl);
    const calendars = await calendarsOf(rescheduled);
    expect(calendars).toEqual(
      expect.arrayContaining([
        expect.stringMatching(new RegExp(`METHOD:REQUEST[\\s\\S]*UID:${moved.id}@codeyoung`)),
        expect.stringMatching(
          new RegExp(`METHOD:CANCEL[\\s\\S]*UID:${original.id}@codeyoung[\\s\\S]*SEQUENCE:1`),
        ),
      ]),
    );

    const emailOf = (firstName: string) =>
      mentors.find((mentor) => mentor.fullName.startsWith(firstName))?.email ?? 'unknown';
    const oldMentorMails = await mailsTo(emailOf(original.mentor.firstName));
    const movedAway = oldMentorMails.find((mail) => mail.Subject.startsWith('Off your schedule'));
    expect(movedAway?.Text).toContain("Leo's family moved their trial class to another time");
    expect((await calendarsOf(movedAway))[0]).toContain('METHOD:CANCEL');
    const newMentorMails = await mailsTo(emailOf(moved.mentor.firstName));
    expect(newMentorMails.map((mail) => mail.Subject)).toContain(
      'New trial class with Leo on Sunday 25 October',
    );
  });

  it('on reassign: parent learns the new mentor, the previous mentor gets a cancellation', async () => {
    const priya = await addMentor(db, 'Priya Raghavan');
    const parent = await TestParent.signUp(app);
    const booking = await parent.book(SATURDAY);
    await relay.runBatch();
    const karthik = await addMentor(db, 'Karthik Menon');
    // What the ops reassign command (BE-08) writes.
    await db.query(
      `UPDATE bookings SET mentor_id = $1, ics_sequence = ics_sequence + 1,
              mentor_join_token = $2 WHERE id = $3`,
      [karthik.id, 'k'.repeat(43), booking.id],
    );
    await db.query(`INSERT INTO outbox_messages (type, payload) VALUES ('BookingReassigned', $1)`, [
      { bookingId: booking.id, previousMentorId: priya.id },
    ]);

    await relay.runBatch();

    const [, update] = await waitForMails(parent.email, 2);
    expect(update?.Subject).toBe("New mentor for Leo's trial class on Saturday 24 October");
    expect(update?.Text).toContain("Karthik will now teach Leo's trial class.");
    expect((await calendarsOf(update))[0]).toContain('SEQUENCE:1');
    const [, movedAway] = await waitForMails(priya.email, 2);
    expect(movedAway?.Text).toContain('Our team moved the trial class with Leo to another mentor.');
    const [welcome] = await waitForMails(karthik.email, 1);
    expect(welcome?.Text).toContain(`http://localhost:5173/class/${'k'.repeat(43)}`);
  });
});

describe('relay reliability', () => {
  it('retries a failed email later without re-sending the ones already delivered (FR-N4)', async () => {
    const mentor = await addMentor(db, 'Priya Raghavan');
    const parent = await TestParent.signUp(app);
    await parent.book(SATURDAY);
    transport.failFor = (mail) => mail.to.email === mentor.email;

    expect(await relay.runBatch()).toMatchObject({ claimed: 1, retried: 1 });

    const [failed] = await outbox('BookingConfirmed');
    expect(failed).toMatchObject({ status: 'PENDING', attempts: 1 });
    expect(failed?.run_after.toISOString()).toBe('2026-10-20T00:02:00.000Z');
    expect(failed?.last_error).toContain('550 Mailbox unavailable');
    expect(failed?.last_error).not.toContain(mentor.email);
    await waitForMails(parent.email, 1);

    transport.failFor = null;
    expect((await relay.runBatch()).claimed).toBe(0);
    clock.advance({ minutes: 2 });
    expect(await relay.runBatch()).toMatchObject({ claimed: 1, done: 1 });

    await waitForMails(mentor.email, 1);
    expect(await mailsTo(parent.email)).toHaveLength(1);
    expect(single(await outbox('BookingConfirmed'))).toMatchObject({
      status: 'DONE',
      attempts: 2,
      last_error: null,
    });
  });

  it('backs off 2, 4, 8 ... minutes and marks the message DEAD after 8 attempts', async () => {
    const mentor = await addMentor(db, 'Priya Raghavan');
    const parent = await TestParent.signUp(app);
    await parent.book(SATURDAY);
    transport.failFor = (mail) => mail.to.email === mentor.email;

    const waits: number[] = [];
    for (let attempt = 1; attempt <= 8; attempt += 1) {
      await relay.runBatch();
      const row = single(await outbox('BookingConfirmed'));
      if (row.status === 'DEAD') break;
      const now = clock.now().epochMilliseconds;
      waits.push((row.run_after.getTime() - now) / 60_000);
      clock.advance({ minutes: 60 });
    }

    expect(waits).toEqual([2, 4, 8, 16, 32, 60, 60]);
    expect(single(await outbox('BookingConfirmed'))).toMatchObject({ status: 'DEAD', attempts: 8 });
    clock.advance({ hours: 2 });
    expect((await relay.runBatch()).claimed).toBe(0);
    expect(await mailsTo(parent.email)).toHaveLength(1);
  });

  it('dead-letters a message that can never succeed without retrying it', async () => {
    await db.query(`INSERT INTO outbox_messages (type, payload) VALUES ('Unheard', '{}')`);

    expect(await relay.runBatch()).toMatchObject({ claimed: 1, dead: 1 });
    expect(single(await outbox('Unheard'))).toMatchObject({
      status: 'DEAD',
      attempts: 1,
      last_error: 'PermanentFailure: Unknown message type Unheard',
    });
  });

  it('requeues messages whose worker stopped, and gives up on one that keeps doing so', async () => {
    await db.query(
      `INSERT INTO outbox_messages (type, payload, status, attempts, locked_at) VALUES
         ('Stuck', '{}', 'PROCESSING', 0, $1),
         ('Busy', '{}', 'PROCESSING', 0, $2),
         ('Poison', '{}', 'PROCESSING', 7, $1)`,
      ['2026-10-19T23:54:00Z', '2026-10-19T23:58:00Z'],
    );

    await relay.releaseStuck();

    expect(single(await outbox('Stuck'))).toMatchObject({
      status: 'PENDING',
      attempts: 1,
      last_error: 'Processing did not finish (worker stopped)',
    });
    expect(single(await outbox('Busy'))).toMatchObject({ status: 'PROCESSING', attempts: 0 });
    expect(single(await outbox('Poison'))).toMatchObject({ status: 'DEAD', attempts: 8 });
  });

  it('lets two workers poll at once without sending anything twice', async () => {
    const parents = await Promise.all([1, 2, 3, 4, 5, 6].map(() => TestParent.signUp(app)));
    await db.query(
      `INSERT INTO outbox_messages (type, payload)
       SELECT 'PasswordChanged', jsonb_build_object('userId', id, 'reason', 'CHANGED') FROM users`,
    );
    const second = await createTestWorker({ clock, env: { DATABASE_URL: database.url } });
    try {
      const results = await Promise.all([relay.runBatch(), second.get(OutboxRelay).runBatch()]);

      expect(results[0].claimed + results[1].claimed).toBe(6);
    } finally {
      await second.close();
    }
    for (const parent of parents) {
      const [mail] = await waitForMails(parent.email, 1);
      expect(mail?.Subject).toBe('Your Codeyoung password was changed');
    }
  });
});

describe('password emails', () => {
  it('sends a working one-time reset link, scrubs the token, then confirms the reset', async () => {
    const parent = await TestParent.signUp(app);
    await api(app).post('/api/v1/auth/password/forgot').send({ email: parent.email }).expect(202);

    await relay.runBatch();

    const [reset] = await waitForMails(parent.email, 1);
    expect(reset?.Subject).toBe('Reset your Codeyoung password');
    expect(reset?.Text).toContain('The link works once and for 30 minutes.');
    const link = /http:\/\/localhost:5173\/reset-password\?token=(\S+)/.exec(reset?.Text ?? '');
    const token = decodeURIComponent(link?.[1] ?? '');
    expect(token).not.toBe('');
    const [message] = await outbox('PasswordResetRequested');
    expect(message?.status).toBe('DONE');
    expect(message?.payload).not.toHaveProperty('token');
    expect(JSON.stringify(message?.payload)).not.toContain(token);

    await api(app)
      .post('/api/v1/auth/password/reset')
      .send({ token, newPassword: 'amber-orchard-compass' })
      .expect(204);
    await relay.runBatch();

    const [, changed] = await waitForMails(parent.email, 2);
    expect(changed?.Subject).toBe('Your Codeyoung password was reset');
    expect(changed?.Text).toContain('http://localhost:5173/forgot-password');
  });

  it('does not send a reset link that expired before the worker got to it', async () => {
    const parent = await TestParent.signUp(app);
    await api(app).post('/api/v1/auth/password/forgot').send({ email: parent.email }).expect(202);
    clock.advance({ minutes: 31 });

    expect(await relay.runBatch()).toMatchObject({ claimed: 1, done: 1 });
    expect(await mailsTo(parent.email)).toHaveLength(0);
  });

  it('tells the parent when their password was changed', async () => {
    const parent = await TestParent.signUp(app);
    await parent
      .post('/auth/password/change', {
        currentPassword: PASSWORD,
        newPassword: 'amber-orchard-compass',
      })
      .expect(204);

    await relay.runBatch();

    const [changed] = await waitForMails(parent.email, 1);
    expect(changed?.Subject).toBe('Your Codeyoung password was changed');
  });
});

describe('housekeeping', () => {
  it('completes a class an hour after it ends, which frees the child for another trial', async () => {
    await addMentor(db, 'Priya Raghavan');
    const parent = await TestParent.signUp(app);
    const booking = await parent.book(SATURDAY);
    const completion = worker.get(CompleteBookingsService);

    clock.set('2026-10-24T17:59:00Z');
    expect(await completion.run()).toBe(0);
    clock.set('2026-10-24T18:01:00Z');
    expect(await completion.run()).toBe(1);

    expect(
      single(
        await db.query<{ status: string }[]>('SELECT status FROM bookings WHERE id = $1', [
          booking.id,
        ]),
      ),
    ).toEqual({ status: 'COMPLETED' });
    expect(
      single(
        await db.query<{ actor: string }[]>(
          `SELECT actor FROM booking_events WHERE booking_id = $1 AND type = 'COMPLETED'`,
          [booking.id],
        ),
      ),
    ).toEqual({ actor: 'system:worker' });
    await parent.logInAgain();
    const [child] = StudentSchema.array().parse(
      (await parent.get('/me/students').expect(200)).body,
    );
    expect(child?.upcomingTrial).toBeNull();
    await parent.book('2026-10-27T16:00:00Z', child?.id);
  });

  it('deletes expired refresh and reset tokens and sessions expired over 30 days ago', async () => {
    const parent = await TestParent.signUp(app);
    await api(app).post('/api/v1/auth/password/forgot').send({ email: parent.email }).expect(202);
    await parent.logInAgain();
    const { id: userId } = single<{ id: string }>(await db.query('SELECT id FROM users'));
    const sessions = await db.query(
      'SELECT id FROM auth_sessions WHERE user_id = $1 ORDER BY created_at',
      [userId],
    );
    expect(sessions).toHaveLength(2);
    await db.query(`UPDATE auth_sessions SET expires_at = '2026-09-19T00:00:00Z' WHERE id = $1`, [
      sessions[0]?.id,
    ]);
    await db.query(`UPDATE auth_sessions SET expires_at = '2026-10-01T00:00:00Z' WHERE id = $1`, [
      sessions[1]?.id,
    ]);
    clock.advance({ hours: 8 * 24 });

    await worker.get(CredentialCleanupService).run();

    expect(await db.query('SELECT id FROM auth_sessions')).toEqual([{ id: sessions[1]?.id }]);
    expect(await db.query('SELECT id FROM refresh_tokens')).toEqual([]);
    expect(await db.query('SELECT id FROM password_reset_tokens')).toEqual([]);
  });
});
