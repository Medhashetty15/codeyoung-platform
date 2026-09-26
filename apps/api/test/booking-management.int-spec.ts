/**
 * Managing bookings end to end: list with paging, cancel (FR-B8, E-12),
 * atomic reschedule (FR-B9, E-13) and the calendar download (FR-B10).
 * Mentors teach 19:00 to 23:00 IST (13:30Z to 17:30Z); clock Tue 20 Oct 00:00Z.
 */
import { randomUUID } from 'node:crypto';

import { type NestExpressApplication } from '@nestjs/platform-express';
import { type DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  AuthResponseSchema,
  BookingListResponseSchema,
  BookingSchema,
  ProblemSchema,
  SlotsResponseSchema,
  StudentSchema,
} from '@app/contracts';

import { connectMigrated, createTestDatabase, single, type TestDatabase } from './support/database';
import { ManualClock } from './support/manual-clock';
import { api, createTestApp } from './support/test-app';

let database: TestDatabase;
let db: DataSource;
let app: NestExpressApplication;
const START = '2026-10-20T00:00:00Z';
const PASSWORD = 'violet-harbour-lantern';
const clock = new ManualClock(START);

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
  clock.set(START);
  await db.query('TRUNCATE users, mentors, outbox_messages RESTART IDENTITY CASCADE');
});

async function addMentor(name: string, cap = 2): Promise<string> {
  const id = single<{ id: string }>(
    await db.query(
      `INSERT INTO mentors (full_name, email, timezone, max_trials_per_day)
       VALUES ($1, $2, 'Asia/Kolkata', $3) RETURNING id`,
      [name, `${randomUUID()}@example.com`, cap],
    ),
  ).id;
  await db.query(
    `INSERT INTO mentor_availability_rules (mentor_id, weekday, start_local, end_local, effective_from)
     SELECT $1::uuid, d, time '19:00', time '23:00', date '2026-01-01' FROM generate_series(1, 7) AS d`,
    [id],
  );
  return id;
}

const CHILD_NAMES = ['Leo', 'Maya', 'Arjun', 'Zoe', 'Ivy', 'Noah'];

class Parent {
  private children = 0;

  constructor(
    private readonly email: string,
    private accessToken: string,
  ) {}

  static async signUp(): Promise<Parent> {
    const email = `${randomUUID()}@example.com`;
    const response = await api(app)
      .post('/api/v1/auth/register')
      .send({ fullName: 'Hannah Okafor', email, password: PASSWORD, timezone: 'Europe/London' })
      .expect(201);
    return new Parent(email, AuthResponseSchema.parse(response.body).accessToken);
  }

  /** A fresh access token after the test clock jumped past the 15-minute lifetime. */
  async logInAgain(): Promise<void> {
    const response = await api(app)
      .post('/api/v1/auth/login')
      .send({ email: this.email, password: PASSWORD })
      .expect(200);
    this.accessToken = AuthResponseSchema.parse(response.body).accessToken;
  }

  get(path: string) {
    return api(app).get(`/api/v1${path}`).set('Authorization', `Bearer ${this.accessToken}`);
  }

  post(path: string, body: object = {}, key?: string) {
    const request = api(app)
      .post(`/api/v1${path}`)
      .set('Authorization', `Bearer ${this.accessToken}`);
    if (key !== undefined) request.set('Idempotency-Key', key);
    return request.send(body);
  }

  async child(firstName: string): Promise<string> {
    return StudentSchema.parse(
      (await this.post('/me/students', { firstName, age: 9 }).expect(201)).body,
    ).id;
  }

  /** Books with a new child each time (one upcoming trial per child). */
  async book(slotStart: string, firstName = CHILD_NAMES[this.children] ?? 'Sam') {
    this.children += 1;
    const studentId = await this.child(firstName);
    const response = await this.post(
      '/bookings',
      { slotStart, timezone: 'Europe/London', student: { id: studentId } },
      randomUUID(),
    ).expect(201);
    return BookingSchema.parse(response.body);
  }
}

describe('GET /bookings', () => {
  it('pages upcoming bookings soonest first and moves finished or cancelled ones to past', async () => {
    await addMentor('Priya Raghavan');
    await addMentor('Karthik Menon');
    const parent = await Parent.signUp();
    const late = await parent.book('2026-10-25T14:00:00Z');
    const early = await parent.book('2026-10-21T14:00:00Z');
    const middle = await parent.book('2026-10-23T14:00:00Z');
    const other = await Parent.signUp();
    await other.book('2026-10-22T14:00:00Z');

    const first = BookingListResponseSchema.parse(
      (await parent.get('/bookings?limit=2').expect(200)).body,
    );
    const second = BookingListResponseSchema.parse(
      (await parent.get(`/bookings?limit=2&cursor=${first.nextCursor ?? ''}`).expect(200)).body,
    );
    expect(first.items.map((item) => item.id)).toEqual([early.id, middle.id]);
    expect(second.items.map((item) => item.id)).toEqual([late.id]);
    expect(second.nextCursor).toBeNull();
    expect(first.items[0]).toMatchObject({
      reference: early.reference,
      student: { firstName: early.student.firstName },
      mentor: { firstName: expect.any(String) },
      canCancel: true,
      canReschedule: true,
      rescheduledToId: null,
    });

    await parent.post(`/bookings/${middle.id}/cancel`).expect(200);
    clock.advance({ hours: 40 }); // Wed 21 Oct 16:00Z: the earliest class has ended.
    await parent.logInAgain();
    const upcoming = BookingListResponseSchema.parse(
      (await parent.get('/bookings').expect(200)).body,
    );
    const past = BookingListResponseSchema.parse(
      (await parent.get('/bookings?scope=past').expect(200)).body,
    );
    expect(upcoming.items.map((item) => item.id)).toEqual([late.id]);
    expect(past.items.map((item) => [item.id, item.status])).toEqual([
      [middle.id, 'CANCELLED'],
      [early.id, 'CONFIRMED'],
    ]);
  });

  it('rejects a tampered cursor', async () => {
    const parent = await Parent.signUp();

    const response = await parent.get('/bookings?cursor=not-a-cursor').expect(400);

    expect(response.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      errors: [{ path: 'cursor' }],
    });
  });
});

describe('POST /bookings/:id/cancel', () => {
  it('cancels, records why, emails both sides and frees the time at once (E-12)', async () => {
    await addMentor('Priya Raghavan', 1);
    const parent = await Parent.signUp();
    const booking = await parent.book('2026-10-24T14:00:00Z');

    const response = await parent
      .post(`/bookings/${booking.id}/cancel`, { reason: 'SCHEDULE_CHANGED' })
      .expect(200);

    expect(BookingSchema.parse(response.body)).toMatchObject({
      status: 'CANCELLED',
      canCancel: false,
      canReschedule: false,
    });
    const row = single<{ cancelled_by: string; cancel_reason: string; ics_sequence: number }>(
      await db.query(`SELECT cancelled_by, cancel_reason, ics_sequence FROM bookings`),
    );
    expect(row).toEqual({
      cancelled_by: 'PARENT',
      cancel_reason: 'SCHEDULE_CHANGED',
      ics_sequence: 1,
    });
    const events: { type: string }[] = await db.query(
      `SELECT type FROM booking_events ORDER BY id`,
    );
    expect(events.map((event) => event.type)).toEqual(['CREATED', 'CANCELLED']);
    const outbox: { type: string }[] = await db.query(
      `SELECT type FROM outbox_messages ORDER BY id`,
    );
    expect(outbox.map((message) => message.type)).toContain('BookingCancelled');

    // The mentor's only daily place is free again for another family.
    const slots = SlotsResponseSchema.parse(
      (
        await api(app)
          .get('/api/v1/availability/slots')
          .query({ tz: 'UTC', from: '2026-10-24', days: '1' })
      ).body,
    );
    expect(slots.days[0]?.slots.map((slot) => slot.start)).toContain('2026-10-24T14:00:00Z');
    await (await Parent.signUp()).book('2026-10-24T14:00:00Z');
  });

  it('refuses to cancel twice, after the start, or someone else’s booking', async () => {
    await addMentor('Priya Raghavan');
    const parent = await Parent.signUp();
    const cancelled = await parent.book('2026-10-24T14:00:00Z');
    const started = await parent.book('2026-10-25T14:00:00Z');
    await parent.post(`/bookings/${cancelled.id}/cancel`).expect(200);

    const twice = await parent.post(`/bookings/${cancelled.id}/cancel`).expect(409);
    clock.advance({ hours: 5 * 24 + 14 });
    await parent.logInAgain();
    const late = await parent.post(`/bookings/${started.id}/cancel`).expect(409);
    const foreign = await (
      await Parent.signUp()
    )
      .post(`/bookings/${started.id}/cancel`)
      .expect(404);

    expect(ProblemSchema.parse(twice.body)).toMatchObject({ reason: 'NOT_CONFIRMED' });
    expect(ProblemSchema.parse(late.body)).toMatchObject({ reason: 'ALREADY_STARTED' });
    expect(foreign.body).toMatchObject({ code: 'BOOKING_NOT_FOUND' });
  });

  it('accepts only the documented reasons (PD-14)', async () => {
    await addMentor('Priya Raghavan');
    const parent = await Parent.signUp();
    const booking = await parent.book('2026-10-24T14:00:00Z');

    await parent.post(`/bookings/${booking.id}/cancel`, { reason: 'bored' }).expect(400);
  });
});

describe('POST /bookings/:id/reschedule', () => {
  it('moves the trial to a new booking and keeps the history (FR-B9)', async () => {
    await addMentor('Priya Raghavan');
    const parent = await Parent.signUp();
    const old = await parent.book('2026-10-24T14:00:00Z');
    const key = randomUUID();

    const response = await parent
      .post(
        `/bookings/${old.id}/reschedule`,
        { slotStart: '2026-10-26T15:00:00Z', timezone: 'Europe/London' },
        key,
      )
      .expect(201);
    const replay = await parent
      .post(
        `/bookings/${old.id}/reschedule`,
        { slotStart: '2026-10-26T15:00:00Z', timezone: 'Europe/London' },
        key,
      )
      .expect(200);

    const moved = BookingSchema.parse(response.body);
    expect(moved).toMatchObject({
      status: 'CONFIRMED',
      start: '2026-10-26T15:00:00Z',
      student: old.student,
      rescheduledFromId: old.id,
    });
    expect(replay.body).toEqual(response.body);
    expect((await parent.get(`/bookings/${old.id}`).expect(200)).body).toMatchObject({
      status: 'RESCHEDULED',
      rescheduledToId: moved.id,
      canCancel: false,
    });
    const events: { booking_id: string; type: string }[] = await db.query(
      `SELECT booking_id, type FROM booking_events ORDER BY id`,
    );
    expect(events).toEqual([
      { booking_id: old.id, type: 'CREATED' },
      { booking_id: old.id, type: 'RESCHEDULED_TO' },
      { booking_id: moved.id, type: 'RESCHEDULED_FROM' },
      { booking_id: moved.id, type: 'CREATED' },
    ]);
    const outbox: { type: string }[] = await db.query(
      `SELECT type FROM outbox_messages ORDER BY id`,
    );
    expect(outbox.filter((message) => message.type === 'BookingRescheduled')).toHaveLength(1);
    expect(outbox.filter((message) => message.type === 'BookingConfirmed')).toHaveLength(1);
  });

  it('can move a class within the same mentor day, even onto its own old time (docs/03 §5.3)', async () => {
    await addMentor('Priya Raghavan', 1);
    const parent = await Parent.signUp();
    const old = await parent.book('2026-10-24T14:00:00Z');

    const response = await parent
      .post(
        `/bookings/${old.id}/reschedule`,
        { slotStart: '2026-10-24T14:30:00Z', timezone: 'Europe/London' },
        randomUUID(),
      )
      .expect(201);

    expect(response.body).toMatchObject({ start: '2026-10-24T14:30:00Z' });
  });

  it('keeps the old booking when the new time is taken (E-13)', async () => {
    await addMentor('Priya Raghavan', 1);
    const parent = await Parent.signUp();
    const old = await parent.book('2026-10-24T14:00:00Z');

    const response = await parent
      .post(
        `/bookings/${old.id}/reschedule`,
        { slotStart: '2026-10-24T18:00:00Z', timezone: 'Europe/London' },
        randomUUID(),
      )
      .expect(409);

    expect(ProblemSchema.parse(response.body)).toMatchObject({ code: 'NO_MENTOR_AVAILABLE' });
    expect((await parent.get(`/bookings/${old.id}`)).body).toMatchObject({ status: 'CONFIRMED' });
    expect(await db.query(`SELECT id FROM bookings`)).toHaveLength(1);
  });

  it('stops 2 hours before the start', async () => {
    await addMentor('Priya Raghavan');
    const parent = await Parent.signUp();
    const booking = await parent.book('2026-10-24T14:00:00Z');
    clock.advance({ hours: 4 * 24 + 12 });
    await parent.logInAgain();

    const response = await parent
      .post(
        `/bookings/${booking.id}/reschedule`,
        { slotStart: '2026-10-26T15:00:00Z', timezone: 'Europe/London' },
        randomUUID(),
      )
      .expect(409);

    expect(ProblemSchema.parse(response.body)).toMatchObject({ reason: 'PAST_RESCHEDULE_CUTOFF' });
  });

  it('lets exactly one of two parents move into the last free place', async () => {
    await addMentor('Priya Raghavan', 5);
    const hannah = await Parent.signUp();
    const daniel = await Parent.signUp();
    const first = await hannah.book('2026-10-24T13:30:00Z');
    const second = await daniel.book('2026-10-24T16:00:00Z');
    const body = { slotStart: '2026-10-25T14:00:00Z', timezone: 'Europe/London' };

    const responses = await Promise.all([
      hannah.post(`/bookings/${first.id}/reschedule`, body, randomUUID()),
      daniel.post(`/bookings/${second.id}/reschedule`, body, randomUUID()),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    const confirmed: { count: string }[] = await db.query(
      `SELECT count(*) FROM bookings WHERE status = 'CONFIRMED'`,
    );
    expect(confirmed).toEqual([{ count: '2' }]);
  });
});

describe('GET /bookings/:id/calendar.ics', () => {
  it('downloads the class as a calendar event in UTC', async () => {
    await addMentor('Priya Raghavan');
    const parent = await Parent.signUp();
    const booking = await parent.book('2026-10-24T14:00:00Z', 'Leo');

    const response = await parent.get(`/bookings/${booking.id}/calendar.ics`).expect(200);

    expect(response.headers['content-type']).toBe('text/calendar; charset=utf-8');
    expect(response.headers['content-disposition']).toBe(
      `attachment; filename="codeyoung-trial-${booking.reference}.ics"`,
    );
    const ics = response.text;
    expect(ics).toContain('METHOD:PUBLISH');
    expect(ics).toContain(`UID:${booking.id}@codeyoung`);
    expect(ics).toContain('DTSTART:20261024T140000Z');
    expect(ics).toContain('DTEND:20261024T150000Z');
    expect(ics).toContain('SEQUENCE:0');
    expect(ics).toContain('SUMMARY:Codeyoung trial class for Leo');
    expect(ics).not.toMatch(/[–—]/);
  });

  it('only exists for booked trials of the parent', async () => {
    await addMentor('Priya Raghavan');
    const parent = await Parent.signUp();
    const booking = await parent.book('2026-10-24T14:00:00Z');
    await (await Parent.signUp()).get(`/bookings/${booking.id}/calendar.ics`).expect(404);
    await parent.post(`/bookings/${booking.id}/cancel`).expect(200);

    const response = await parent.get(`/bookings/${booking.id}/calendar.ics`).expect(409);

    expect(response.body).toMatchObject({
      code: 'BOOKING_NOT_MODIFIABLE',
      reason: 'NOT_CONFIRMED',
    });
  });
});
