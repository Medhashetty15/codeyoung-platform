/**
 * Public availability API against real PostgreSQL (docs/03 §4, §9; M3 "slots
 * match hand-computed expectations for NY / London / Kolkata").
 *
 * Hand-computed dataset: mentor Priya (Asia/Kolkata), Sundays 01:30 to 05:30
 * IST (the docs/04 §2 worked example) and Monday to Friday 21:00 to 23:00 IST.
 * 60-minute classes plus a 15-minute buffer on the 30-minute UTC grid:
 * - Sun 25 Oct 01:30 to 05:30 IST = Sat 24 Oct 20:00Z to 24:00Z
 *   -> starts 20:00, 20:30, 21:00, 21:30, 22:00, 22:30Z (22:30 + 75 min = 23:45).
 * - Mon 26 Oct 21:00 to 23:00 IST = 15:30Z to 17:30Z -> starts 15:30, 16:00Z.
 * The clock is Tue 20 Oct 00:00Z, so the first bookable slot is Tue 20 Oct
 * 21:00 IST = 15:30Z.
 */
import { type NestExpressApplication } from '@nestjs/platform-express';
import { type DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { BookingConfigSchema, SlotsResponseSchema, TimezonesResponseSchema } from '@app/contracts';

import { AppConfig } from '../src/config/app-config';
import { DatabaseSeeder } from '../src/database/seed/database-seeder';
import { PasswordHasher } from '../src/modules/users/infra/password-hasher';

import { connectMigrated, createTestDatabase, single, type TestDatabase } from './support/database';
import { ManualClock } from './support/manual-clock';
import { api, createTestApp, TEST_JWT_SECRET } from './support/test-app';

let database: TestDatabase;
let db: DataSource;
let app: NestExpressApplication;
const clock = new ManualClock('2026-10-20T00:00:00Z');

beforeAll(async () => {
  database = await createTestDatabase();
  db = await connectMigrated(database.url);
  app = await createTestApp({ clock, env: { DATABASE_URL: database.url } });
});

afterAll(async () => {
  await app.close();
  await db.destroy();
  await database.drop();
});

async function slots(query: Record<string, string>) {
  const response = await api(app).get('/api/v1/availability/slots').query(query).expect(200);
  return SlotsResponseSchema.parse(response.body);
}

const startsOn = (response: Awaited<ReturnType<typeof slots>>, date: string) =>
  response.days.find((day) => day.date === date)?.slots.map((slot) => slot.start) ?? [];

describe('hand-computed single mentor', () => {
  let mentorId: string;

  beforeEach(async () => {
    await db.query('TRUNCATE users, mentors RESTART IDENTITY CASCADE');
    mentorId = single<{ id: string }>(
      await db.query(
        `INSERT INTO mentors (full_name, email, timezone) VALUES ('Priya Raghavan', 'priya@example.com', 'Asia/Kolkata') RETURNING id`,
      ),
    ).id;
    await db.query(
      `INSERT INTO mentor_availability_rules (mentor_id, weekday, start_local, end_local, effective_from)
       SELECT $1::uuid, 7, time '01:30', time '05:30', date '2026-01-01'
       UNION ALL
       SELECT $1::uuid, d, time '21:00', time '23:00', date '2026-01-01' FROM generate_series(1, 5) AS d`,
      [mentorId],
    );
  });

  const SATURDAY = [
    '2026-10-24T20:00:00Z',
    '2026-10-24T20:30:00Z',
    '2026-10-24T21:00:00Z',
    '2026-10-24T21:30:00Z',
    '2026-10-24T22:00:00Z',
    '2026-10-24T22:30:00Z',
  ];
  const MONDAY = ['2026-10-26T15:30:00Z', '2026-10-26T16:00:00Z'];

  it('London: Saturday evening, nothing on Sunday (clocks go back), Monday afternoon', async () => {
    const response = await slots({ tz: 'Europe/London', from: '2026-10-24', days: '3' });

    expect(response).toMatchObject({ timezone: 'Europe/London', slotDurationMinutes: 60 });
    expect(response.days.map((day) => [day.date, day.status])).toEqual([
      ['2026-10-24', 'AVAILABLE'],
      ['2026-10-25', 'NO_AVAILABILITY'],
      ['2026-10-26', 'AVAILABLE'],
    ]);
    expect(startsOn(response, '2026-10-24')).toEqual(SATURDAY);
    expect(startsOn(response, '2026-10-26')).toEqual(MONDAY);
    expect(response.days[1]?.dstTransition).toEqual({
      at: '2026-10-25T01:00:00Z',
      offsetBefore: '+01:00',
      offsetAfter: '+00:00',
    });
    expect(response.days[0]?.slots[0]).toEqual({
      start: '2026-10-24T20:00:00Z',
      end: '2026-10-24T21:00:00Z',
    });
    expect(response.nextAvailable).toEqual({
      start: '2026-10-20T15:30:00Z',
      end: '2026-10-20T16:30:00Z',
    });
  });

  it('New York: the same instants, Saturday afternoon and Monday morning, no DST notice yet', async () => {
    const response = await slots({ tz: 'America/New_York', from: '2026-10-24', days: '3' });

    expect(startsOn(response, '2026-10-24')).toEqual(SATURDAY);
    expect(startsOn(response, '2026-10-25')).toEqual([]);
    expect(startsOn(response, '2026-10-26')).toEqual(MONDAY);
    expect(response.days.some((day) => day.dstTransition !== undefined)).toBe(false);
  });

  it('Kolkata: the Saturday slots belong to Sunday in India', async () => {
    const response = await slots({ tz: 'Asia/Kolkata', from: '2026-10-24', days: '3' });

    expect(startsOn(response, '2026-10-24')).toEqual([]);
    expect(startsOn(response, '2026-10-25')).toEqual(SATURDAY);
    expect(startsOn(response, '2026-10-26')).toEqual(MONDAY);
  });

  it('shows a day as fully booked once the mentor reached the daily cap', async () => {
    const parent = single<{ id: string }>(
      await db.query(
        `INSERT INTO users (email, password_hash, full_name, timezone) VALUES ('p@example.com', 'h', 'P', 'UTC') RETURNING id`,
      ),
    ).id;
    for (const [name, start, end, blocked] of [
      ['Leo', '2026-10-24T20:00:00Z', '2026-10-24T21:00:00Z', '2026-10-24T21:15:00Z'],
      ['Maya', '2026-10-24T21:30:00Z', '2026-10-24T22:30:00Z', '2026-10-24T22:45:00Z'],
    ] as const) {
      const student = single<{ id: string }>(
        await db.query(
          `INSERT INTO students (parent_id, first_name, age) VALUES ($1, $2, 9) RETURNING id`,
          [parent, name],
        ),
      ).id;
      await db.query(
        `INSERT INTO bookings (reference, parent_id, student_id, mentor_id, starts_at, ends_at, blocked_until,
           mentor_local_date, parent_timezone, mentor_timezone, parent_join_token, mentor_join_token, meeting_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, '2026-10-25', 'UTC', 'Asia/Kolkata', $8, $9, 'https://x.test/c')`,
        [
          `CY-${name.toUpperCase().padEnd(6, 'X')}`,
          parent,
          student,
          mentorId,
          start,
          end,
          blocked,
          `${name}-p`,
          `${name}-m`,
        ],
      );
    }

    const response = await slots({ tz: 'Europe/London', from: '2026-10-24', days: '1' });

    expect(response.days[0]).toMatchObject({ status: 'FULLY_BOOKED', slots: [] });
  });

  it('treats time off and inactive mentors as no classes', async () => {
    await db.query(
      `INSERT INTO mentor_time_off (mentor_id, starts_at, ends_at) VALUES ($1, '2026-10-24T19:00:00Z', '2026-10-25T01:00:00Z')`,
      [mentorId],
    );
    expect(
      (await slots({ tz: 'Europe/London', from: '2026-10-24', days: '1' })).days[0]?.status,
    ).toBe('NO_AVAILABILITY');

    await db.query(`UPDATE mentors SET is_active = false`);
    const inactive = await slots({ tz: 'Europe/London', from: '2026-10-26', days: '1' });

    expect(inactive.days[0]?.status).toBe('NO_AVAILABILITY');
    expect(inactive.nextAvailable).toBeNull();
  });

  it('ignores cancelled bookings', async () => {
    const parent = single<{ id: string }>(
      await db.query(
        `INSERT INTO users (email, password_hash, full_name, timezone) VALUES ('p@example.com', 'h', 'P', 'UTC') RETURNING id`,
      ),
    ).id;
    const student = single<{ id: string }>(
      await db.query(
        `INSERT INTO students (parent_id, first_name, age) VALUES ($1, 'Leo', 9) RETURNING id`,
        [parent],
      ),
    ).id;
    await db.query(
      `INSERT INTO bookings (reference, parent_id, student_id, mentor_id, starts_at, ends_at, blocked_until,
         mentor_local_date, parent_timezone, mentor_timezone, parent_join_token, mentor_join_token, meeting_url,
         status, cancelled_by, cancelled_at)
       VALUES ('CY-CANCEL', $1, $2, $3, '2026-10-24T20:00:00Z', '2026-10-24T21:00:00Z', '2026-10-24T21:15:00Z',
         '2026-10-25', 'UTC', 'Asia/Kolkata', 'c-p', 'c-m', 'https://x.test/c', 'CANCELLED', 'PARENT', now())`,
      [parent, student, mentorId],
    );

    expect(
      startsOn(await slots({ tz: 'UTC', from: '2026-10-24', days: '1' }), '2026-10-24'),
    ).toEqual(SATURDAY);
  });

  it('finds the next available slot beyond an empty window', async () => {
    const response = await slots({ tz: 'Europe/London', from: '2026-10-25', days: '1' });

    expect(response.days[0]?.status).toBe('NO_AVAILABILITY');
    expect(response.nextAvailable?.start).toBe('2026-10-20T15:30:00Z');
  });

  it('defaults to 14 days from today in the requested zone, by the server clock', async () => {
    const london = await slots({ tz: 'Europe/London' });
    const losAngeles = await slots({ tz: 'America/Los_Angeles' });

    expect(london.days).toHaveLength(14);
    expect(london.days[0]?.date).toBe('2026-10-20');
    // 00:00Z on 20 Oct is still 19 Oct in Los Angeles.
    expect(losAngeles.days[0]?.date).toBe('2026-10-19');
    expect(london.generatedAt).toBe('2026-10-20T00:00:00Z');
  });

  it('accepts legacy zone ids and answers with the canonical one', async () => {
    expect((await slots({ tz: 'Asia/Calcutta', from: '2026-10-25', days: '1' })).timezone).toBe(
      'Asia/Kolkata',
    );
  });
});

describe('query validation', () => {
  it.each([
    [{ tz: 'Mars/Olympus' }, 'INVALID_TIMEZONE'],
    [{ tz: 'Europe/London', days: '15' }, 'VALIDATION_FAILED'],
    [{ tz: 'Europe/London', from: '2026-02-30' }, 'VALIDATION_FAILED'],
    [{ tz: 'Europe/London', from: '2026-11-10' }, 'VALIDATION_FAILED'],
    [{ tz: 'Europe/London', from: '2026-10-17' }, 'VALIDATION_FAILED'],
    [{}, 'VALIDATION_FAILED'],
  ])('rejects %j with %s', async (query, code) => {
    const response = await api(app).get('/api/v1/availability/slots').query(query).expect(400);

    expect(response.body).toMatchObject({ code });
  });

  it('is public and asks clients to revalidate', async () => {
    const response = await api(app)
      .get('/api/v1/availability/slots')
      .query({ tz: 'UTC', days: '1' })
      .expect(200);

    expect(response.headers['cache-control']).toBe('no-cache');
  });
});

describe('seeded demo data', () => {
  beforeAll(async () => {
    const config = AppConfig.fromEnv({
      DATABASE_URL: database.url,
      JWT_ACCESS_SECRET: TEST_JWT_SECRET,
    });
    await new DatabaseSeeder(db, new PasswordHasher(), config).seed({ reset: true });
  });

  it('offers the worked example: Sat 4 PM in New York is Sat 9 PM in London and Sun 1:30 AM in India', async () => {
    const newYork = await slots({ tz: 'America/New_York', from: '2026-10-24', days: '1' });
    const london = await slots({ tz: 'Europe/London', from: '2026-10-24', days: '1' });
    const kolkata = await slots({ tz: 'Asia/Kolkata', from: '2026-10-25', days: '1' });

    for (const response of [newYork, london, kolkata]) {
      expect(response.days[0]?.slots.map((slot) => slot.start)).toContain('2026-10-24T20:00:00Z');
    }
  });

  it('covers UK weekday evenings and US after-school hours', async () => {
    const london = await slots({ tz: 'Europe/London', from: '2026-10-27', days: '1' });
    const newYork = await slots({ tz: 'America/New_York', from: '2026-10-27', days: '1' });

    // Tue 27 Oct: 5 PM in London (GMT) and 4 PM in New York (EDT).
    expect(startsOn(london, '2026-10-27')).toContain('2026-10-27T17:00:00Z');
    expect(startsOn(newYork, '2026-10-27')).toContain('2026-10-27T20:00:00Z');
  });

  it('has slots on every day of the horizon and none beyond it', async () => {
    const response = await slots({ tz: 'Europe/London', from: '2026-10-21' });

    // The horizon ends 14 days after now (Tue 3 Nov 00:00Z): the 14th London date is past it.
    expect(response.days.slice(0, 13).every((day) => day.status === 'AVAILABLE')).toBe(true);
    expect(response.days[13]).toMatchObject({ date: '2026-11-03', status: 'NO_AVAILABILITY' });
  });
});

describe('/meta', () => {
  it('publishes the booking knobs (PD-03, PD-15)', async () => {
    const response = await api(app).get('/api/v1/meta/booking-config').expect(200);

    expect(BookingConfigSchema.parse(response.body)).toEqual({
      slotDurationMinutes: 60,
      slotGridMinutes: 30,
      horizonDays: 14,
      leadTimeMinutes: 240,
      rescheduleCutoffMinutes: 120,
      classroomOpensMinutesBefore: 10,
      mentorTimezone: 'Asia/Kolkata',
    });
  });

  it('publishes the zone catalogue', async () => {
    const response = await api(app).get('/api/v1/meta/timezones').expect(200);

    const catalog = TimezonesResponseSchema.parse(response.body);
    expect(catalog.suggested[0]?.id).toBe('America/New_York');
    expect(response.headers['cache-control']).toContain('max-age=86400');
  });
});
