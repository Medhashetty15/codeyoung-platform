/**
 * Every database-enforced invariant from docs/03 §3.4 and ADR 0004, proven
 * against real PostgreSQL. Rows are inserted with plain SQL so each test shows
 * exactly which column values the constraint accepts or rejects.
 */
import { randomUUID } from 'node:crypto';

import { type DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { BookingEntity } from '../../src/modules/bookings/infra/booking.entity';
import {
  connectMigrated,
  createTestDatabase,
  expectViolation,
  PG,
  single,
  type TestDatabase,
} from '../support/database';

let database: TestDatabase;
let db: DataSource;

beforeAll(async () => {
  database = await createTestDatabase();
  db = await connectMigrated(database.url);
});

afterAll(async () => {
  await db.destroy();
  await database.drop();
});

beforeEach(async () => {
  await db.query(
    `TRUNCATE users, mentors, outbox_messages, waitlist_entries RESTART IDENTITY CASCADE`,
  );
});

// ---- row builders --------------------------------------------------------------

async function insertUser(email = `${randomUUID()}@example.com`): Promise<string> {
  const rows: { id: string }[] = await db.query(
    `INSERT INTO users (email, password_hash, full_name, timezone)
     VALUES ($1, 'hash', 'Hannah Okafor', 'Europe/London') RETURNING id`,
    [email],
  );
  return single(rows).id;
}

async function insertMentor(email = `${randomUUID()}@example.com`): Promise<string> {
  const rows: { id: string }[] = await db.query(
    `INSERT INTO mentors (full_name, email, timezone) VALUES ('Priya Raghavan', $1, 'Asia/Kolkata') RETURNING id`,
    [email],
  );
  return single(rows).id;
}

async function insertStudent(parentId: string, firstName = 'Leo', age = 9): Promise<string> {
  const rows: { id: string }[] = await db.query(
    `INSERT INTO students (parent_id, first_name, age) VALUES ($1, $2, $3) RETURNING id`,
    [parentId, firstName, age],
  );
  return single(rows).id;
}

interface BookingValues {
  parentId: string;
  studentId: string;
  mentorId: string;
  startsAt: string;
  endsAt: string;
  blockedUntil: string;
  status: string;
  cancelledBy: string | null;
  idempotencyKey: string | null;
}

/** A 60-minute class with a 15-minute buffer, confirmed by default. */
async function insertBooking(values: Partial<BookingValues> & Pick<BookingValues, 'mentorId'>) {
  const parentId = values.parentId ?? (await insertUser());
  const studentId =
    values.studentId ?? (await insertStudent(parentId, `Kid${randomUUID().slice(0, 6)}`));
  const startsAt = values.startsAt ?? '2026-10-24T16:00:00Z';
  const rows: { id: string }[] = await db.query(
    `INSERT INTO bookings (
       reference, parent_id, student_id, mentor_id, starts_at, ends_at, blocked_until,
       mentor_local_date, parent_timezone, mentor_timezone, status, cancelled_by,
       parent_join_token, mentor_join_token, meeting_url, idempotency_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7, '2026-10-24', 'Europe/London', 'Asia/Kolkata', $8, $9,
             $10, $11, 'https://app.codeyoung.dev/class/x', $12)
     RETURNING id`,
    [
      `CY-${randomUUID().slice(0, 6).toUpperCase()}`,
      parentId,
      studentId,
      values.mentorId,
      startsAt,
      values.endsAt ?? '2026-10-24T17:00:00Z',
      values.blockedUntil ?? '2026-10-24T17:15:00Z',
      values.status ?? 'CONFIRMED',
      values.cancelledBy ?? null,
      randomUUID(),
      randomUUID(),
      values.idempotencyKey ?? null,
    ],
  );
  return single(rows).id;
}

// ---- bookings --------------------------------------------------------------------

describe('bookings_no_mentor_overlap (exclusion)', () => {
  it('rejects a second confirmed class for the same mentor at the same time', async () => {
    const mentorId = await insertMentor();
    await insertBooking({ mentorId });

    await expectViolation(insertBooking({ mentorId }), PG.EXCLUSION, 'bookings_no_mentor_overlap');
  });

  it('keeps the buffer: a class starting at the previous end is rejected', async () => {
    const mentorId = await insertMentor();
    await insertBooking({ mentorId });

    await expectViolation(
      insertBooking({
        mentorId,
        startsAt: '2026-10-24T17:00:00Z',
        endsAt: '2026-10-24T18:00:00Z',
        blockedUntil: '2026-10-24T18:15:00Z',
      }),
      PG.EXCLUSION,
    );
  });

  it('allows a class starting exactly when the buffer ends (half-open range)', async () => {
    const mentorId = await insertMentor();
    await insertBooking({ mentorId });

    await expect(
      insertBooking({
        mentorId,
        startsAt: '2026-10-24T17:15:00Z',
        endsAt: '2026-10-24T18:15:00Z',
        blockedUntil: '2026-10-24T18:30:00Z',
      }),
    ).resolves.toBeTypeOf('string');
  });

  it('allows another mentor at the same time', async () => {
    await insertBooking({ mentorId: await insertMentor() });

    await expect(insertBooking({ mentorId: await insertMentor() })).resolves.toBeTypeOf('string');
  });

  it('ignores cancelled, rescheduled and completed classes', async () => {
    const mentorId = await insertMentor();
    for (const status of ['CANCELLED', 'RESCHEDULED', 'COMPLETED']) {
      await insertBooking({ mentorId, status });
    }

    await expect(insertBooking({ mentorId })).resolves.toBeTypeOf('string');
  });

  it('rejects confirming a cancelled class that now overlaps', async () => {
    const mentorId = await insertMentor();
    const cancelled = await insertBooking({ mentorId, status: 'CANCELLED' });
    await insertBooking({ mentorId });

    await expectViolation(
      db.query(`UPDATE bookings SET status = 'CONFIRMED' WHERE id = $1`, [cancelled]),
      PG.EXCLUSION,
    );
  });
});

describe('bookings_one_upcoming_per_student (partial unique index)', () => {
  it('allows one confirmed trial per child', async () => {
    const parentId = await insertUser();
    const studentId = await insertStudent(parentId);
    await insertBooking({ mentorId: await insertMentor(), parentId, studentId });

    await expectViolation(
      insertBooking({
        mentorId: await insertMentor(),
        parentId,
        studentId,
        startsAt: '2026-10-25T16:00:00Z',
        endsAt: '2026-10-25T17:00:00Z',
        blockedUntil: '2026-10-25T17:15:00Z',
      }),
      PG.UNIQUE,
      'bookings_one_upcoming_per_student',
    );
  });

  it('lets the child book again once the trial is no longer confirmed', async () => {
    const parentId = await insertUser();
    const studentId = await insertStudent(parentId);
    await insertBooking({
      mentorId: await insertMentor(),
      parentId,
      studentId,
      status: 'COMPLETED',
    });

    await expect(
      insertBooking({ mentorId: await insertMentor(), parentId, studentId }),
    ).resolves.toBeTypeOf('string');
  });
});

describe('bookings idempotency key', () => {
  it('is unique per parent', async () => {
    const parentId = await insertUser();
    const idempotencyKey = randomUUID();
    await insertBooking({ mentorId: await insertMentor(), parentId, idempotencyKey });

    await expectViolation(
      insertBooking({ mentorId: await insertMentor(), parentId, idempotencyKey }),
      PG.UNIQUE,
      'bookings_parent_id_idempotency_key_key',
    );
  });

  it('may repeat across parents and be absent any number of times', async () => {
    const idempotencyKey = randomUUID();
    await insertBooking({ mentorId: await insertMentor(), idempotencyKey });
    await insertBooking({ mentorId: await insertMentor(), idempotencyKey });
    const parentId = await insertUser();
    await insertBooking({ mentorId: await insertMentor(), parentId });

    await expect(insertBooking({ mentorId: await insertMentor(), parentId })).resolves.toBeTypeOf(
      'string',
    );
  });
});

describe('bookings checks', () => {
  it.each([
    [
      'end not after start',
      { endsAt: '2026-10-24T16:00:00Z', blockedUntil: '2026-10-24T16:00:00Z' },
    ],
    ['buffer ending before the class', { blockedUntil: '2026-10-24T16:59:00Z' }],
  ])('rejects %s', async (_label, times) => {
    await expectViolation(
      insertBooking({ mentorId: await insertMentor(), ...times }),
      PG.CHECK,
      'bookings_time_order_check',
    );
  });

  it('rejects unknown statuses and cancellers', async () => {
    await expectViolation(
      insertBooking({ mentorId: await insertMentor(), status: 'PENDING' }),
      PG.CHECK,
      'bookings_status_check',
    );
    await expectViolation(
      insertBooking({ mentorId: await insertMentor(), status: 'CANCELLED', cancelledBy: 'MENTOR' }),
      PG.CHECK,
      'bookings_cancelled_by_check',
    );
  });

  it('refuses to delete a parent who has bookings (history is kept)', async () => {
    const parentId = await insertUser();
    await insertBooking({ mentorId: await insertMentor(), parentId });

    await expectViolation(db.query(`DELETE FROM users WHERE id = $1`, [parentId]), PG.FOREIGN_KEY);
  });

  it('reads date columns as plain YYYY-MM-DD strings in any process zone', async () => {
    const id = await insertBooking({ mentorId: await insertMentor() });

    const booking = await db.getRepository(BookingEntity).findOneByOrFail({ id });

    expect(booking.mentorLocalDate).toBe('2026-10-24');
    expect(booking.startsAt.toISOString()).toBe('2026-10-24T16:00:00.000Z');
  });
});

// ---- people -----------------------------------------------------------------------

describe('users', () => {
  it('treats emails case-insensitively (citext)', async () => {
    await insertUser('Hannah@Okafor.co.uk');

    await expectViolation(insertUser('hannah@okafor.CO.UK'), PG.UNIQUE, 'users_email_key');
  });

  it('only knows the PARENT role', async () => {
    await expectViolation(
      db.query(
        `INSERT INTO users (email, password_hash, full_name, timezone, role)
         VALUES ('ops@example.com', 'h', 'Ops', 'UTC', 'ADMIN')`,
      ),
      PG.CHECK,
      'users_role_check',
    );
  });

  it('removes sessions and refresh tokens with the user', async () => {
    const userId = await insertUser();
    const session = single<{ id: string }>(
      await db.query(
        `INSERT INTO auth_sessions (user_id, expires_at) VALUES ($1, now() + interval '30 days') RETURNING id`,
        [userId],
      ),
    );
    await db.query(
      `INSERT INTO refresh_tokens (session_id, token_hash, expires_at) VALUES ($1, '\\x01', now() + interval '7 days')`,
      [session.id],
    );

    await db.query(`DELETE FROM users WHERE id = $1`, [userId]);

    const [counts]: { sessions: string; tokens: string }[] = await db.query(
      `SELECT (SELECT count(*) FROM auth_sessions) AS sessions, (SELECT count(*) FROM refresh_tokens) AS tokens`,
    );
    expect(counts).toEqual({ sessions: '0', tokens: '0' });
  });

  it('only accepts documented session revoke reasons', async () => {
    const userId = await insertUser();

    await expectViolation(
      db.query(
        `INSERT INTO auth_sessions (user_id, expires_at, revoke_reason) VALUES ($1, now(), 'BORED')`,
        [userId],
      ),
      PG.CHECK,
      'auth_sessions_revoke_reason_check',
    );
  });
});

describe('students', () => {
  it.each([3, 19])('rejects age %i', async (age) => {
    await expectViolation(
      insertStudent(await insertUser(), 'Leo', age),
      PG.CHECK,
      'students_age_check',
    );
  });

  it('allows one child per name per parent, ignoring case', async () => {
    const parentId = await insertUser();
    await insertStudent(parentId, 'Leo');

    await expectViolation(insertStudent(parentId, 'leo'), PG.UNIQUE, 'students_parent_name');
    await expect(insertStudent(await insertUser(), 'Leo')).resolves.toBeTypeOf('string');
  });
});

describe('mentors and availability', () => {
  it('requires a positive daily cap', async () => {
    await expectViolation(
      db.query(
        `INSERT INTO mentors (full_name, email, timezone, max_trials_per_day)
         VALUES ('Karthik Menon', 'k@example.com', 'Asia/Kolkata', 0)`,
      ),
      PG.CHECK,
      'mentors_max_trials_per_day_check',
    );
  });

  async function insertRule(mentorId: string, rule: Record<string, unknown>): Promise<unknown> {
    const values = {
      weekday: 1,
      start: '19:00',
      end: '23:00',
      from: '2026-01-01',
      to: null,
      ...rule,
    };
    return db.query(
      `INSERT INTO mentor_availability_rules (mentor_id, weekday, start_local, end_local, effective_from, effective_to)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [mentorId, values.weekday, values.start, values.end, values.from, values.to],
    );
  }

  it.each([
    ['weekday 0', { weekday: 0 }, 'mentor_availability_rules_weekday_check'],
    ['weekday 8', { weekday: 8 }, 'mentor_availability_rules_weekday_check'],
    ['an empty window', { start: '19:00', end: '19:00' }, 'mentor_availability_rules_window_check'],
    [
      'an end date before the start date',
      { to: '2025-12-31' },
      'mentor_availability_rules_effective_check',
    ],
  ])('rejects %s', async (_label, rule, constraint) => {
    await expectViolation(insertRule(await insertMentor(), rule), PG.CHECK, constraint);
  });

  it('accepts a window that crosses midnight', async () => {
    await expect(
      insertRule(await insertMentor(), { start: '21:00', end: '01:30' }),
    ).resolves.toBeDefined();
  });

  it('rejects time off that ends before it starts', async () => {
    await expectViolation(
      db.query(
        `INSERT INTO mentor_time_off (mentor_id, starts_at, ends_at)
         VALUES ($1, '2026-10-24T18:00:00Z', '2026-10-24T17:00:00Z')`,
        [await insertMentor()],
      ),
      PG.CHECK,
      'mentor_time_off_range_check',
    );
  });
});

// ---- messaging & waitlist -------------------------------------------------------

describe('outbox and email deliveries', () => {
  it('only accepts documented outbox statuses', async () => {
    await expectViolation(
      db.query(`INSERT INTO outbox_messages (type, payload, status) VALUES ('X', '{}', 'LOST')`),
      PG.CHECK,
      'outbox_messages_status_check',
    );
  });

  it('records one delivery per message, template and recipient (case-insensitive)', async () => {
    const message = single<{ id: string }>(
      await db.query(
        `INSERT INTO outbox_messages (type, payload) VALUES ('BookingConfirmed', '{}') RETURNING id`,
      ),
    );
    const deliver = (email: string) =>
      db.query(
        `INSERT INTO email_deliveries (outbox_message_id, template, recipient_email, recipient_timezone)
         VALUES ($1, 'booking-confirmed-parent', $2, 'Europe/London')`,
        [message.id, email],
      );
    await deliver('hannah@okafor.co.uk');

    await expectViolation(
      deliver('Hannah@Okafor.co.uk'),
      PG.UNIQUE,
      'email_deliveries_outbox_message_id_template_recipient_email_key',
    );
  });
});

describe('waitlist', () => {
  const join = (email: string, status = 'OPEN') =>
    db.query(
      `INSERT INTO waitlist_entries (full_name, email, timezone, status) VALUES ('Daniel Reyes', $1, 'America/Chicago', $2)`,
      [email, status],
    );

  it('keeps one open entry per email, ignoring case', async () => {
    await join('daniel@reyes.us');

    await expectViolation(join('Daniel@Reyes.US'), PG.UNIQUE, 'waitlist_one_open_per_email');
  });

  it('allows a new open entry once the old one is closed', async () => {
    await join('daniel@reyes.us', 'CLOSED');

    await expect(join('daniel@reyes.us')).resolves.toBeDefined();
  });

  it('only accepts documented statuses', async () => {
    await expectViolation(
      join('daniel@reyes.us', 'MAYBE'),
      PG.CHECK,
      'waitlist_entries_status_check',
    );
  });
});
