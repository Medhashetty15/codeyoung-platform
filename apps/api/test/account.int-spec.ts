/**
 * Account end to end: profile (`/me`), children (`/me/students`), forgot /
 * reset / change password with session revocation (E-21, E-22, E-24), and the
 * documented auth rate limits.
 */
import { randomUUID } from 'node:crypto';

import { type NestExpressApplication } from '@nestjs/platform-express';
import { type DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  AuthResponseSchema,
  MeSchema,
  ProblemSchema,
  StudentListSchema,
  StudentSchema,
} from '@app/contracts';

import { connectMigrated, createTestDatabase, single, type TestDatabase } from './support/database';
import { cookieHeader, requireRefreshCookie } from './support/http-cookies';
import { ManualClock } from './support/manual-clock';
import { api, createTestApp } from './support/test-app';

const PASSWORD = 'violet-harbour-lantern';
const NEW_PASSWORD = 'amber-kestrel-orchard';
const REQUESTED_WITH = ['X-Requested-With', 'cy-web'] as const;

let database: TestDatabase;
let db: DataSource;
let app: NestExpressApplication;
const clock = new ManualClock();

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

interface Parent {
  email: string;
  accessToken: string;
  refreshToken: string;
}

async function signUp(email = `${randomUUID()}@example.com`): Promise<Parent> {
  const response = await api(app)
    .post('/api/v1/auth/register')
    .send({ fullName: 'Hannah Okafor', email, password: PASSWORD, timezone: 'Europe/London' })
    .expect(201);
  return {
    email,
    accessToken: AuthResponseSchema.parse(response.body).accessToken,
    refreshToken: requireRefreshCookie(response.headers).value,
  };
}

async function logIn(email: string, password = PASSWORD): Promise<Parent> {
  const response = await api(app).post('/api/v1/auth/login').send({ email, password }).expect(200);
  return {
    email,
    accessToken: AuthResponseSchema.parse(response.body).accessToken,
    refreshToken: requireRefreshCookie(response.headers).value,
  };
}

const as = (parent: Parent) => ({
  get: (path: string) =>
    api(app).get(`/api/v1${path}`).set('Authorization', `Bearer ${parent.accessToken}`),
  post: (path: string, body: object) =>
    api(app).post(`/api/v1${path}`).set('Authorization', `Bearer ${parent.accessToken}`).send(body),
  patch: (path: string, body: object) =>
    api(app)
      .patch(`/api/v1${path}`)
      .set('Authorization', `Bearer ${parent.accessToken}`)
      .send(body),
});

function refresh(token: string) {
  return api(app)
    .post('/api/v1/auth/refresh')
    .set(...REQUESTED_WITH)
    .set('Cookie', cookieHeader(token));
}

async function resetTokenFromOutbox(): Promise<string> {
  const row = single<{ token: string }>(
    await db.query(
      `SELECT payload->>'token' AS token FROM outbox_messages
        WHERE type = 'PasswordResetRequested' ORDER BY id DESC LIMIT 1`,
    ),
  );
  return row.token;
}

describe('/me', () => {
  it('returns the profile', async () => {
    const parent = await signUp('hannah@okafor.co.uk');

    const response = await as(parent).get('/me').expect(200);

    expect(MeSchema.parse(response.body)).toMatchObject({
      email: 'hannah@okafor.co.uk',
      fullName: 'Hannah Okafor',
      phone: null,
      timezone: 'Europe/London',
    });
  });

  it('updates name, phone and zone, canonicalising the zone', async () => {
    const parent = await signUp();

    const response = await as(parent)
      .patch('/me', { fullName: 'Hannah O.', phone: '+44 20 7946 0958', timezone: 'Asia/Calcutta' })
      .expect(200);
    const cleared = await as(parent).patch('/me', { phone: null }).expect(200);

    expect(response.body).toMatchObject({ fullName: 'Hannah O.', timezone: 'Asia/Kolkata' });
    expect(cleared.body).toMatchObject({ phone: null, fullName: 'Hannah O.' });
  });

  it('rejects empty and invalid updates', async () => {
    const parent = await signUp();

    await as(parent).patch('/me', {}).expect(400);
    expect(
      (await as(parent).patch('/me', { timezone: 'Mars/Olympus' }).expect(400)).body,
    ).toMatchObject({
      code: 'INVALID_TIMEZONE',
    });
  });
});

describe('/me/students', () => {
  it('adds and lists children', async () => {
    const parent = await signUp();

    const created = await as(parent)
      .post('/me/students', { firstName: ' Leo ', age: 9 })
      .expect(201);
    await as(parent).post('/me/students', { firstName: 'Maya', age: 12 }).expect(201);
    const list = await as(parent).get('/me/students').expect(200);

    expect(StudentSchema.parse(created.body)).toMatchObject({
      firstName: 'Leo',
      age: 9,
      upcomingTrial: null,
    });
    expect(StudentListSchema.parse(list.body).map((student) => student.firstName)).toEqual([
      'Leo',
      'Maya',
    ]);
  });

  it('refuses a second child with the same name, in any case', async () => {
    const parent = await signUp();
    await as(parent).post('/me/students', { firstName: 'Leo', age: 9 }).expect(201);

    const response = await as(parent)
      .post('/me/students', { firstName: 'leo', age: 7 })
      .expect(409);

    expect(response.body).toMatchObject({ code: 'STUDENT_NAME_TAKEN' });
  });

  it('validates the age range', async () => {
    const parent = await signUp();

    await as(parent).post('/me/students', { firstName: 'Leo', age: 3 }).expect(400);
    await as(parent).post('/me/students', { firstName: 'Leo', age: 19 }).expect(400);
  });

  it("edits own children and treats other parents' children as missing", async () => {
    const hannah = await signUp();
    const daniel = await signUp();
    const leo = StudentSchema.parse(
      (await as(hannah).post('/me/students', { firstName: 'Leo', age: 9 })).body,
    );

    const edited = await as(hannah).patch(`/me/students/${leo.id}`, { age: 10 }).expect(200);
    const foreign = await as(daniel).patch(`/me/students/${leo.id}`, { age: 11 }).expect(404);
    const malformed = await as(hannah).patch('/me/students/not-a-uuid', { age: 11 }).expect(404);

    expect(edited.body).toMatchObject({ firstName: 'Leo', age: 10 });
    expect(foreign.body).toMatchObject({ code: 'STUDENT_NOT_FOUND' });
    expect(malformed.body).toMatchObject({ code: 'STUDENT_NOT_FOUND' });
    expect((await as(daniel).get('/me/students')).body).toEqual([]);
  });

  it("shows a child's upcoming confirmed trial (PD-04)", async () => {
    const parent = await signUp();
    const leo = StudentSchema.parse(
      (await as(parent).post('/me/students', { firstName: 'Leo', age: 9 })).body,
    );
    const mentor = single<{ id: string }>(
      await db.query(
        `INSERT INTO mentors (full_name, email, timezone) VALUES ('Priya Raghavan', 'priya@example.com', 'Asia/Kolkata') RETURNING id`,
      ),
    );
    const parentId = single<{ id: string }>(
      await db.query(`SELECT id FROM users WHERE email = $1`, [parent.email]),
    ).id;
    const booking = single<{ id: string }>(
      await db.query(
        `INSERT INTO bookings (reference, parent_id, student_id, mentor_id, starts_at, ends_at, blocked_until,
           mentor_local_date, parent_timezone, mentor_timezone, parent_join_token, mentor_join_token, meeting_url)
         VALUES ('CY-7K3Q9P', $1, $2, $3, '2026-10-24T16:00:00Z', '2026-10-24T17:00:00Z', '2026-10-24T17:15:00Z',
           '2026-10-24', 'Europe/London', 'Asia/Kolkata', 'p-token', 'm-token', 'https://app.codeyoung.dev/class/p-token')
         RETURNING id`,
        [parentId, leo.id, mentor.id],
      ),
    );

    const list = StudentListSchema.parse((await as(parent).get('/me/students').expect(200)).body);

    expect(list[0]?.upcomingTrial).toEqual({
      bookingId: booking.id,
      start: '2026-10-24T16:00:00Z',
    });
  });
});

describe('forgot and reset password', () => {
  it('always answers 202 and only writes an outbox email for real accounts (E-21)', async () => {
    await signUp('hannah@okafor.co.uk');

    await api(app)
      .post('/api/v1/auth/password/forgot')
      .send({ email: 'nobody@example.com' })
      .expect(202);
    const known = await api(app)
      .post('/api/v1/auth/password/forgot')
      .send({ email: 'Hannah@Okafor.co.uk' })
      .expect(202);

    expect(known.body).toEqual({});
    const rows: { type: string; payload: { token: string; expiresAt: string } }[] = await db.query(
      `SELECT type, payload FROM outbox_messages`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: 'PasswordResetRequested',
      payload: { token: expect.any(String) },
    });
    expect(rows[0]?.payload.expiresAt).toBe(
      clock.now().add({ minutes: 30 }).toString({ smallestUnit: 'second' }),
    );
  });

  it('resets the password, signs every session out and emails a notice (E-24)', async () => {
    const parent = await signUp();
    const otherDevice = await logIn(parent.email);
    await api(app).post('/api/v1/auth/password/forgot').send({ email: parent.email }).expect(202);

    await api(app)
      .post('/api/v1/auth/password/reset')
      .send({ token: await resetTokenFromOutbox(), newPassword: NEW_PASSWORD })
      .expect(204);

    await refresh(parent.refreshToken).expect(401);
    await refresh(otherDevice.refreshToken).expect(401);
    await api(app)
      .post('/api/v1/auth/login')
      .send({ email: parent.email, password: PASSWORD })
      .expect(401);
    await logIn(parent.email, NEW_PASSWORD);
    const notices: { payload: { reason: string } }[] = await db.query(
      `SELECT payload FROM outbox_messages WHERE type = 'PasswordChanged'`,
    );
    expect(notices.map((notice) => notice.payload.reason)).toEqual(['RESET']);
  });

  it('accepts a reset link only once (E-22)', async () => {
    const parent = await signUp();
    await api(app).post('/api/v1/auth/password/forgot').send({ email: parent.email }).expect(202);
    const token = await resetTokenFromOutbox();
    await api(app)
      .post('/api/v1/auth/password/reset')
      .send({ token, newPassword: NEW_PASSWORD })
      .expect(204);

    const again = await api(app)
      .post('/api/v1/auth/password/reset')
      .send({ token, newPassword: 'another-fine-password' })
      .expect(400);

    expect(again.body).toMatchObject({ code: 'RESET_TOKEN_INVALID' });
  });

  it('expires reset links after 30 minutes', async () => {
    const parent = await signUp();
    await api(app).post('/api/v1/auth/password/forgot').send({ email: parent.email }).expect(202);
    const token = await resetTokenFromOutbox();
    clock.advance({ minutes: 30 });

    await api(app)
      .post('/api/v1/auth/password/reset')
      .send({ token, newPassword: NEW_PASSWORD })
      .expect(400);
  });

  it('invalidates older links when a new one is requested', async () => {
    const parent = await signUp();
    await api(app).post('/api/v1/auth/password/forgot').send({ email: parent.email }).expect(202);
    const first = await resetTokenFromOutbox();
    await api(app).post('/api/v1/auth/password/forgot').send({ email: parent.email }).expect(202);
    const second = await resetTokenFromOutbox();

    await api(app)
      .post('/api/v1/auth/password/reset')
      .send({ token: first, newPassword: NEW_PASSWORD })
      .expect(400);
    await api(app)
      .post('/api/v1/auth/password/reset')
      .send({ token: second, newPassword: NEW_PASSWORD })
      .expect(204);
  });

  it('keeps the link usable when the new password is weak', async () => {
    const parent = await signUp();
    await api(app).post('/api/v1/auth/password/forgot').send({ email: parent.email }).expect(202);
    const token = await resetTokenFromOutbox();

    const weak = await api(app)
      .post('/api/v1/auth/password/reset')
      .send({ token, newPassword: 'short' })
      .expect(400);

    expect(ProblemSchema.parse(weak.body)).toMatchObject({
      code: 'WEAK_PASSWORD',
      reasons: ['TOO_SHORT'],
    });
    await api(app)
      .post('/api/v1/auth/password/reset')
      .send({ token, newPassword: NEW_PASSWORD })
      .expect(204);
  });

  it('rejects unknown reset tokens', async () => {
    const response = await api(app)
      .post('/api/v1/auth/password/reset')
      .send({ token: 'made-up-token', newPassword: NEW_PASSWORD })
      .expect(400);

    expect(response.body).toMatchObject({ code: 'RESET_TOKEN_INVALID' });
  });
});

describe('change password', () => {
  it('changes the password and signs out every other session', async () => {
    const parent = await signUp();
    const otherDevice = await logIn(parent.email);

    await as(parent)
      .post('/auth/password/change', { currentPassword: PASSWORD, newPassword: NEW_PASSWORD })
      .expect(204);

    await refresh(otherDevice.refreshToken).expect(401);
    await refresh(parent.refreshToken).expect(200);
    await logIn(parent.email, NEW_PASSWORD);
    const notice = single<{ payload: { reason: string } }>(
      await db.query(`SELECT payload FROM outbox_messages WHERE type = 'PasswordChanged'`),
    );
    expect(notice.payload.reason).toBe('CHANGED');
  });

  it('requires the current password', async () => {
    const parent = await signUp();

    const response = await as(parent)
      .post('/auth/password/change', { currentPassword: 'guess', newPassword: NEW_PASSWORD })
      .expect(401);

    expect(response.body).toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('applies the password policy to the new password', async () => {
    const parent = await signUp();

    const response = await as(parent)
      .post('/auth/password/change', { currentPassword: PASSWORD, newPassword: 'password1' })
      .expect(400);

    expect(response.body).toMatchObject({ code: 'WEAK_PASSWORD', reasons: ['COMMON'] });
  });

  it('needs a signed-in parent', async () => {
    await api(app)
      .post('/api/v1/auth/password/change')
      .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD })
      .expect(401);
  });
});

describe('rate limits (documented values, multiplier 1)', () => {
  let strict: NestExpressApplication;

  beforeAll(async () => {
    strict = await createTestApp({ clock, env: { DATABASE_URL: database.url } });
  });

  afterAll(async () => {
    await strict.close();
  });

  it('allows 5 logins per minute for one email (from any address)', async () => {
    await signUp('limited@example.com');
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await api(strict)
        .post('/api/v1/auth/login')
        .send({ email: 'limited@example.com', password: 'nope' })
        .expect(401);
    }

    const blocked = await api(strict)
      .post('/api/v1/auth/login')
      .send({ email: 'LIMITED@example.com', password: PASSWORD })
      .expect(429);

    expect(ProblemSchema.parse(blocked.body)).toMatchObject({ code: 'RATE_LIMITED' });
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('allows 5 registrations per hour per address', async () => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await api(strict)
        .post('/api/v1/auth/register')
        .send({
          fullName: 'Sophie Lindqvist',
          email: `s${attempt}@example.com`,
          password: PASSWORD,
          timezone: 'UTC',
        })
        .expect(201);
    }

    await api(strict)
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Sophie Lindqvist',
        email: 's6@example.com',
        password: PASSWORD,
        timezone: 'UTC',
      })
      .expect(429);
  });

  it('allows 3 reset emails per hour for one email', async () => {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await api(strict)
        .post('/api/v1/auth/password/forgot')
        .send({ email: 'someone@example.com' })
        .expect(202);
    }

    await api(strict)
      .post('/api/v1/auth/password/forgot')
      .send({ email: 'someone@example.com' })
      .expect(429);
  });
});
