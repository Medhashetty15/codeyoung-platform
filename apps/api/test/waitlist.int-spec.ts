/** POST /waitlist (FR-W1, E-16): idempotent per email while open, linked to a logged-in parent. */
import { type NestExpressApplication } from '@nestjs/platform-express';
import { type DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ProblemSchema, WaitlistResponseSchema } from '@app/contracts';

import { TestParent } from './support/booking-fixtures';
import { connectMigrated, createTestDatabase, single, type TestDatabase } from './support/database';
import { ManualClock } from './support/manual-clock';
import { api, createTestApp } from './support/test-app';

let database: TestDatabase;
let db: DataSource;
let app: NestExpressApplication;
const clock = new ManualClock('2026-10-20T09:00:00Z');
const ENTRY = {
  fullName: 'Priya Shah',
  email: 'priya.shah@example.com',
  timezone: 'America/New_York',
  preferredTimes: 'Weekday afternoons after 4 PM',
};

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
  await db.query('TRUNCATE users, waitlist_entries RESTART IDENTITY CASCADE');
});

function join(body: object, token?: string) {
  const request = api(app).post('/api/v1/waitlist');
  if (token !== undefined) request.set('Authorization', `Bearer ${token}`);
  return request.send(body);
}

describe('POST /waitlist', () => {
  it('adds an open entry (201), then answers the same entry for the same email (200)', async () => {
    const first = WaitlistResponseSchema.parse((await join(ENTRY).expect(201)).body);
    expect(first).toEqual({
      id: expect.any(String),
      status: 'OPEN',
      createdAt: '2026-10-20T09:00:00Z',
    });

    const again = await join({ ...ENTRY, email: 'PRIYA.SHAH@example.com', preferredTimes: 'Any' });
    expect(again.status).toBe(200);
    expect(WaitlistResponseSchema.parse(again.body).id).toBe(first.id);
    expect(
      single(await db.query<{ n: number }[]>('SELECT count(*)::int AS n FROM waitlist_entries')),
    ).toEqual({ n: 1 });
  });

  it('stores the canonical zone and treats empty preferred times as none', async () => {
    await join({ ...ENTRY, timezone: 'US/Eastern', preferredTimes: '  ' }).expect(201);

    expect(
      single(
        await db.query<unknown[]>(
          'SELECT timezone, preferred_times, user_id FROM waitlist_entries',
        ),
      ),
    ).toEqual({ timezone: 'America/New_York', preferred_times: null, user_id: null });
  });

  it('links the entry to the parent when a valid access token is sent, ignores a bad one', async () => {
    const parent = await TestParent.signUp(app);
    await join({ ...ENTRY, email: parent.email }, parent.bearerToken).expect(201);
    await join({ ...ENTRY, email: 'other@example.com' }, 'not-a-token').expect(201);

    const rows = await db.query<{ email: string; linked: boolean }[]>(
      'SELECT email, user_id IS NOT NULL AS linked FROM waitlist_entries ORDER BY created_at, email',
    );
    expect(rows).toEqual(
      expect.arrayContaining([
        { email: parent.email, linked: true },
        { email: 'other@example.com', linked: false },
      ]),
    );
  });

  it('lets the same email wait again once the earlier entry was closed', async () => {
    const first = WaitlistResponseSchema.parse((await join(ENTRY).expect(201)).body);
    await db.query(`UPDATE waitlist_entries SET status = 'CLOSED' WHERE id = $1`, [first.id]);

    const second = WaitlistResponseSchema.parse((await join(ENTRY).expect(201)).body);
    expect(second.id).not.toBe(first.id);
  });

  it('collapses simultaneous duplicates into one entry', async () => {
    const responses = await Promise.all([1, 2, 3, 4, 5].map(() => join(ENTRY)));

    expect(responses.map((response) => response.status).sort()).toEqual([200, 200, 200, 200, 201]);
    expect(new Set(responses.map((response) => (response.body as { id: string }).id)).size).toBe(1);
  });

  it('validates the body', async () => {
    const badEmail = await join({ ...ENTRY, email: 'nope' }).expect(400);
    expect(ProblemSchema.parse(badEmail.body).code).toBe('VALIDATION_FAILED');

    const badZone = await join({ ...ENTRY, timezone: 'Mars/Olympus' }).expect(400);
    expect(ProblemSchema.parse(badZone.body).code).toBe('INVALID_TIMEZONE');
  });
});

describe('POST /waitlist rate limit', () => {
  it('allows 5 per hour per IP (docs/03 §6.5)', async () => {
    const limited = await createTestApp({ clock, env: { DATABASE_URL: database.url } });
    try {
      for (let index = 0; index < 5; index += 1) {
        await api(limited)
          .post('/api/v1/waitlist')
          .send({ ...ENTRY, email: `family${String(index)}@example.com` })
          .expect(201);
      }
      const blocked = await api(limited)
        .post('/api/v1/waitlist')
        .send({ ...ENTRY, email: 'family5@example.com' })
        .expect(429);
      expect(ProblemSchema.parse(blocked.body).code).toBe('RATE_LIMITED');
    } finally {
      await limited.close();
    }
  });
});
