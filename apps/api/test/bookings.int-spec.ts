/**
 * Booking creation end to end (docs/03 §5.1, FR-B2 to FR-B6, E-1 to E-3, E-15),
 * including the concurrency guarantees: parallel requests for the last free
 * mentors, the daily cap under contention, and double-submitted requests.
 *
 * Mentors teach 19:00 to 23:00 IST daily = 13:30Z to 17:30Z; with a 60-minute
 * class and 15-minute buffer the starts are 13:30Z to 16:00Z. Clock: Tue
 * 20 Oct 2026 00:00Z.
 */
import { randomUUID } from 'node:crypto';

import { type NestExpressApplication } from '@nestjs/platform-express';
import { type DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AuthResponseSchema, BookingSchema, ProblemSchema, StudentSchema } from '@app/contracts';

import { connectMigrated, createTestDatabase, single, type TestDatabase } from './support/database';
import { ManualClock } from './support/manual-clock';
import { api, createTestApp } from './support/test-app';

const SLOT = '2026-10-24T14:00:00Z';

let database: TestDatabase;
let db: DataSource;
let app: NestExpressApplication;
const clock = new ManualClock('2026-10-20T00:00:00Z');

beforeAll(async () => {
  database = await createTestDatabase();
  db = await connectMigrated(database.url);
  app = await createTestApp({
    clock,
    env: { DATABASE_URL: database.url, RATE_LIMIT_MULTIPLIER: '100' },
  });
});

afterAll(async () => {
  await app.close();
  await db.destroy();
  await database.drop();
});

beforeEach(async () => {
  await db.query('TRUNCATE users, mentors, outbox_messages RESTART IDENTITY CASCADE');
});

async function addMentor(
  name: string,
  options: { cap?: number; start?: string; end?: string } = {},
) {
  const email = `${name.toLowerCase().replaceAll(' ', '.')}@example.com`;
  const id = single<{ id: string }>(
    await db.query(
      `INSERT INTO mentors (full_name, email, timezone, max_trials_per_day)
       VALUES ($1, $2, 'Asia/Kolkata', $3) RETURNING id`,
      [name, email, options.cap ?? 2],
    ),
  ).id;
  await db.query(
    `INSERT INTO mentor_availability_rules (mentor_id, weekday, start_local, end_local, effective_from)
     SELECT $1::uuid, d, $2::time, $3::time, date '2026-01-01' FROM generate_series(1, 7) AS d`,
    [id, options.start ?? '19:00', options.end ?? '23:00'],
  );
  return id;
}

interface Parent {
  accessToken: string;
  studentId: string;
}

async function parentWithChild(firstName = 'Leo'): Promise<Parent> {
  const registered = await api(app)
    .post('/api/v1/auth/register')
    .send({
      fullName: 'Hannah Okafor',
      email: `${randomUUID()}@example.com`,
      password: 'violet-harbour-lantern',
      timezone: 'Europe/London',
    })
    .expect(201);
  const { accessToken } = AuthResponseSchema.parse(registered.body);
  const child = await api(app)
    .post('/api/v1/me/students')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ firstName, age: 9 })
    .expect(201);
  return { accessToken, studentId: StudentSchema.parse(child.body).id };
}

function book(
  parent: Parent,
  body: Record<string, unknown> = {},
  key: string | null = randomUUID(),
) {
  const request = api(app)
    .post('/api/v1/bookings')
    .set('Authorization', `Bearer ${parent.accessToken}`);
  if (key !== null) request.set('Idempotency-Key', key);
  return request.send({
    slotStart: SLOT,
    timezone: 'Europe/London',
    student: { id: parent.studentId },
    ...body,
  });
}

describe('POST /bookings', () => {
  it('books the slot with a mentor and records the audit event, emails and reminders', async () => {
    await addMentor('Priya Raghavan');
    const parent = await parentWithChild();

    const response = await book(parent, { timezone: 'America/New_York' }).expect(201);

    const booking = BookingSchema.parse(response.body);
    expect(booking).toMatchObject({
      status: 'CONFIRMED',
      start: SLOT,
      end: '2026-10-24T15:00:00Z',
      timezone: 'America/New_York',
      student: { id: parent.studentId, firstName: 'Leo', age: 9 },
      mentor: { firstName: 'Priya' },
      canCancel: true,
      canReschedule: true,
      rescheduledFromId: null,
      rescheduledToId: null,
      createdAt: '2026-10-20T00:00:00Z',
    });
    expect(booking.joinUrl).toMatch(/^http:\/\/localhost:5173\/class\/[A-Za-z0-9_-]{43}$/);

    const row = single<{ blocked_until: Date; mentor_local_date: string; ics_sequence: number }>(
      await db.query(`SELECT blocked_until, mentor_local_date, ics_sequence FROM bookings`),
    );
    expect(row).toMatchObject({ mentor_local_date: '2026-10-24', ics_sequence: 0 });
    expect(row.blocked_until.toISOString()).toBe('2026-10-24T15:15:00.000Z');
    const events: { type: string; actor: string }[] = await db.query(
      `SELECT type, actor FROM booking_events`,
    );
    expect(events).toEqual([
      { type: 'CREATED', actor: expect.stringMatching(/^parent:[0-9a-f-]{36}$/) },
    ]);
    const outbox: { type: string; run_after: Date }[] = await db.query(
      `SELECT type, run_after FROM outbox_messages ORDER BY id`,
    );
    // The confirmation is due at once; reminders 24 h and 1 h before the start.
    expect(outbox.map((message) => message.type)).toEqual([
      'BookingConfirmed',
      'BookingReminder',
      'BookingReminder',
    ]);
    expect(outbox.slice(1).map((message) => message.run_after.toISOString())).toEqual([
      '2026-10-23T14:00:00.000Z',
      '2026-10-24T13:00:00.000Z',
    ]);
    // The zone confirmed while booking becomes the profile zone (A-11).
    const profile = await api(app)
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${parent.accessToken}`);
    expect(profile.body).toMatchObject({ timezone: 'America/New_York' });
  });

  it('skips reminders whose time has already passed', async () => {
    await addMentor('Priya Raghavan');
    clock.advance({ hours: 100 });
    try {
      // Sat 24 Oct 14:00Z is now 10 hours away: only the 1-hour reminder remains.
      await book(await parentWithChild()).expect(201);
    } finally {
      clock.advance({ hours: -100 });
    }

    const types: { type: string }[] = await db.query(
      `SELECT type FROM outbox_messages ORDER BY id`,
    );
    expect(types.map((row) => row.type)).toEqual(['BookingConfirmed', 'BookingReminder']);
  });

  it('creates a new child inline while booking', async () => {
    await addMentor('Priya Raghavan');
    const parent = await parentWithChild('Leo');

    const response = await book(parent, { student: { firstName: 'Maya', age: 12 } }).expect(201);
    const taken = await book(parent, {
      slotStart: '2026-10-24T15:30:00Z',
      student: { firstName: 'leo', age: 9 },
    }).expect(409);

    expect(response.body).toMatchObject({ student: { firstName: 'Maya', age: 12 } });
    expect(taken.body).toMatchObject({ code: 'STUDENT_NAME_TAKEN' });
  });

  it("refuses another parent's child", async () => {
    await addMentor('Priya Raghavan');
    const hannah = await parentWithChild();
    const daniel = await parentWithChild();

    const response = await book(hannah, { student: { id: daniel.studentId } }).expect(404);

    expect(response.body).toMatchObject({ code: 'STUDENT_NOT_FOUND' });
  });

  it('allows one upcoming trial per child (E-15)', async () => {
    await addMentor('Priya Raghavan');
    await addMentor('Karthik Menon');
    const parent = await parentWithChild();
    const first = BookingSchema.parse((await book(parent).expect(201)).body);

    const second = await book(parent, { slotStart: '2026-10-25T14:00:00Z' }).expect(409);

    expect(ProblemSchema.parse(second.body)).toMatchObject({
      code: 'STUDENT_ALREADY_HAS_TRIAL',
      bookingId: first.id,
    });
  });

  it.each([
    ['2026-10-24T14:15:00Z', 400, 'SLOT_NOT_ON_GRID'],
    ['2026-10-20T03:30:00Z', 422, 'SLOT_IN_PAST'],
    ['2026-11-03T14:00:00Z', 422, 'SLOT_OUTSIDE_HORIZON'],
  ])('rejects %s with %i %s', async (slotStart, status, code) => {
    await addMentor('Priya Raghavan');
    const parent = await parentWithChild();

    const response = await book(parent, { slotStart }).expect(status);

    expect(response.body).toMatchObject({ code });
  });

  it('offers the three nearest free times when nobody can take the slot (E-1)', async () => {
    await addMentor('Priya Raghavan');
    const parent = await parentWithChild();

    const response = await book(parent, { slotStart: '2026-10-24T18:00:00Z' }).expect(409);

    expect(ProblemSchema.parse(response.body)).toMatchObject({
      code: 'NO_MENTOR_AVAILABLE',
      alternatives: [
        { start: '2026-10-24T15:00:00Z', end: '2026-10-24T16:00:00Z' },
        { start: '2026-10-24T15:30:00Z', end: '2026-10-24T16:30:00Z' },
        { start: '2026-10-24T16:00:00Z', end: '2026-10-24T17:00:00Z' },
      ],
    });
    expect(await db.query(`SELECT id FROM students`)).toHaveLength(1);
  });

  it('assigns the least-loaded mentor and respects the daily cap', async () => {
    const priya = await addMentor('Priya Raghavan');
    const karthik = await addMentor('Karthik Menon', { cap: 1 });
    const mentorOf = async (parent: Parent, slotStart: string) =>
      single<{ mentor_id: string }>(
        await db.query(`SELECT mentor_id FROM bookings WHERE id = $1`, [
          BookingSchema.parse((await book(parent, { slotStart }).expect(201)).body).id,
        ]),
      ).mentor_id;

    // Equal load: whoever waited longest wins, and Priya has never been assigned.
    await db.query(`UPDATE mentors SET last_assigned_at = '2026-10-19T00:00:00Z' WHERE id = $1`, [
      karthik,
    ]);
    expect(await mentorOf(await parentWithChild(), '2026-10-24T13:30:00Z')).toBe(priya);
    // Priya has one class that day, Karthik none.
    expect(await mentorOf(await parentWithChild(), '2026-10-24T15:30:00Z')).toBe(karthik);
    // Karthik is at his cap of 1; Priya (1 of 2) takes the next free time, then nobody can.
    expect(await mentorOf(await parentWithChild(), '2026-10-24T15:00:00Z')).toBe(priya);
    const fourth = await book(await parentWithChild(), {
      slotStart: '2026-10-24T16:00:00Z',
    }).expect(409);
    expect(fourth.body).toMatchObject({ code: 'NO_MENTOR_AVAILABLE' });
  });
});

describe('idempotency (E-2)', () => {
  it('returns the same booking for a replayed key', async () => {
    await addMentor('Priya Raghavan');
    const parent = await parentWithChild();
    const key = randomUUID();

    const first = await book(parent, {}, key).expect(201);
    const replay = await book(parent, {}, key).expect(200);

    expect(replay.body).toEqual(first.body);
    expect(await db.query(`SELECT id FROM bookings`)).toHaveLength(1);
  });

  it('refuses a reused key with a different request', async () => {
    await addMentor('Priya Raghavan');
    const parent = await parentWithChild();
    const key = randomUUID();
    await book(parent, {}, key).expect(201);

    const response = await book(parent, { slotStart: '2026-10-24T15:00:00Z' }, key).expect(422);

    expect(response.body).toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
  });

  it('requires a UUID Idempotency-Key header', async () => {
    const parent = await parentWithChild();

    expect((await book(parent, {}, null).expect(400)).body).toMatchObject({
      code: 'VALIDATION_FAILED',
      errors: [{ path: 'headers.idempotency-key', message: expect.any(String) }],
    });
    await book(parent, {}, 'not-a-uuid').expect(400);
  });

  it('turns a double-submitted request into one booking', async () => {
    await addMentor('Priya Raghavan');
    await addMentor('Karthik Menon');
    const parent = await parentWithChild();
    const key = randomUUID();

    const [first, second] = await Promise.all([book(parent, {}, key), book(parent, {}, key)]);

    expect([first.status, second.status].sort()).toEqual([200, 201]);
    expect(first.body.id).toBe(second.body.id);
    expect(await db.query(`SELECT id FROM bookings`)).toHaveLength(1);
  });
});

describe('concurrency (docs/03 §3.4, E-1)', () => {
  it('lets exactly k of N parallel requests win when k mentors are free', async () => {
    const mentors = await Promise.all(
      ['Priya Raghavan', 'Karthik Menon', 'Ananya Iyer'].map((name) => addMentor(name)),
    );
    const parents = await Promise.all(Array.from({ length: 8 }, () => parentWithChild()));

    const responses = await Promise.all(parents.map((parent) => book(parent)));

    const statuses = responses.map((response) => response.status).sort();
    expect(statuses).toEqual([201, 201, 201, 409, 409, 409, 409, 409]);
    for (const response of responses.filter((item) => item.status === 409)) {
      expect(response.body).toMatchObject({ code: 'NO_MENTOR_AVAILABLE' });
    }
    const rows: { mentor_id: string }[] = await db.query(
      `SELECT mentor_id FROM bookings WHERE status = 'CONFIRMED' AND starts_at = $1`,
      [SLOT],
    );
    expect(new Set(rows.map((row) => row.mentor_id))).toEqual(new Set(mentors));
  });

  it('never exceeds the daily cap under contention', async () => {
    await addMentor('Priya Raghavan', { cap: 2, start: '18:00', end: '23:59' });
    const slots = ['12:30', '13:30', '14:30', '15:30', '16:30', '17:30'].map(
      (time) => `2026-10-24T${time}:00Z`,
    );
    const parents = await Promise.all(slots.map(() => parentWithChild()));

    const responses = await Promise.all(
      parents.map((parent, index) => book(parent, { slotStart: slots[index] })),
    );

    expect(responses.filter((response) => response.status === 201)).toHaveLength(2);
    const perDay: { mentor_local_date: string; count: string }[] = await db.query(
      `SELECT mentor_local_date, count(*) FROM bookings WHERE status = 'CONFIRMED' GROUP BY 1`,
    );
    expect(perDay).toEqual([{ mentor_local_date: '2026-10-24', count: '2' }]);
  });
});

describe('GET /bookings/:id', () => {
  it("shows the parent's booking and hides everyone else's (E-23)", async () => {
    await addMentor('Priya Raghavan');
    const hannah = await parentWithChild();
    const daniel = await parentWithChild();
    const booking = BookingSchema.parse((await book(hannah).expect(201)).body);
    const get = (parent: Parent, id: string) =>
      api(app).get(`/api/v1/bookings/${id}`).set('Authorization', `Bearer ${parent.accessToken}`);

    expect((await get(hannah, booking.id).expect(200)).body).toEqual(booking);
    expect((await get(daniel, booking.id).expect(404)).body).toMatchObject({
      code: 'BOOKING_NOT_FOUND',
    });
    expect((await get(hannah, 'not-a-uuid').expect(404)).body).toMatchObject({
      code: 'BOOKING_NOT_FOUND',
    });
    await api(app).get(`/api/v1/bookings/${booking.id}`).expect(401);
  });
});
