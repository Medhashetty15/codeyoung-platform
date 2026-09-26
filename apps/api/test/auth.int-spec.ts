/**
 * Auth end to end (docs/03 §6, ADR 0007): registration, login and lockout,
 * access tokens, refresh rotation with the grace window and reuse detection,
 * logout. Real PostgreSQL, real HTTP pipeline, a manual clock.
 */
import { JwtService } from '@nestjs/jwt';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { type DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AuthResponseSchema, ProblemSchema, RefreshResponseSchema } from '@app/contracts';

import {
  ACCESS_TOKEN_AUDIENCE,
  ACCESS_TOKEN_ISSUER,
} from '../src/modules/auth/application/access-tokens';

import { connectMigrated, createTestDatabase, single, type TestDatabase } from './support/database';
import { cookieHeader, refreshCookie, requireRefreshCookie } from './support/http-cookies';
import { ManualClock } from './support/manual-clock';
import { api, createTestApp, TEST_JWT_SECRET } from './support/test-app';

const PASSWORD = 'violet-harbour-lantern';
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
    // Relaxed per-IP and per-email limits: this suite exercises lockout, not throttling.
    env: { DATABASE_URL: database.url, RATE_LIMIT_MULTIPLIER: '100' },
  });
});

afterAll(async () => {
  await app.close();
  await db.destroy();
  await database.drop();
});

beforeEach(async () => {
  await db.query('TRUNCATE users RESTART IDENTITY CASCADE');
});

let emailCounter = 0;
function newEmail(): string {
  emailCounter += 1;
  return `parent${emailCounter}@example.com`;
}

function register(body: Record<string, unknown> = {}) {
  return api(app)
    .post('/api/v1/auth/register')
    .send({
      fullName: 'Hannah Okafor',
      email: newEmail(),
      password: PASSWORD,
      timezone: 'Europe/London',
      ...body,
    });
}

function login(email: string, password = PASSWORD) {
  return api(app).post('/api/v1/auth/login').send({ email, password });
}

function refresh(token: string) {
  return api(app)
    .post('/api/v1/auth/refresh')
    .set(...REQUESTED_WITH)
    .set('Cookie', cookieHeader(token));
}

function me(accessToken: string) {
  return api(app).get('/api/v1/me').set('Authorization', `Bearer ${accessToken}`);
}

/** Registers a parent and returns its tokens. */
async function signedUp(email = newEmail()) {
  const response = await register({ email }).expect(201);
  const body = AuthResponseSchema.parse(response.body);
  return {
    email,
    accessToken: body.accessToken,
    refreshToken: requireRefreshCookie(response.headers).value,
  };
}

describe('POST /auth/register', () => {
  it('creates the account and signs the parent in', async () => {
    const response = await register({
      email: 'Hannah@Okafor.co.uk',
      phone: '+44 20 7946 0958',
      timezone: 'Asia/Calcutta',
    }).expect(201);

    const body = AuthResponseSchema.parse(response.body);
    expect(body).toMatchObject({
      expiresIn: 900,
      user: {
        email: 'hannah@okafor.co.uk',
        fullName: 'Hannah Okafor',
        phone: '+44 20 7946 0958',
        timezone: 'Asia/Kolkata',
      },
    });
    const cookie = refreshCookie(response.headers);
    expect(cookie?.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(cookie?.attributes.get('path')).toBe('/api/v1/auth');
    expect(cookie?.attributes.get('samesite')).toBe('Strict');
    expect(cookie?.attributes.get('max-age')).toBe(String(7 * 24 * 3600));
    expect(cookie?.attributes.has('httponly')).toBe(true);
    expect(cookie?.attributes.has('secure')).toBe(true);
  });

  it('stores only an argon2id hash and a hashed refresh token', async () => {
    const { refreshToken } = await signedUp('leo.parent@example.com');

    const user = single<{ password_hash: string }>(
      await db.query(`SELECT password_hash FROM users WHERE email = 'leo.parent@example.com'`),
    );
    const tokens: { token_hash: Buffer }[] = await db.query(
      `SELECT token_hash FROM refresh_tokens`,
    );
    expect(user.password_hash).toMatch(/^\$argon2id\$/);
    expect(tokens.map((token) => token.token_hash.toString('base64url'))).not.toContain(
      refreshToken,
    );
  });

  it('rejects an email that is already registered, in any case', async () => {
    await signedUp('daniel@reyes.us');

    const response = await register({ email: 'Daniel@Reyes.US' }).expect(409);

    expect(response.body).toMatchObject({ code: 'EMAIL_ALREADY_REGISTERED' });
  });

  it.each([
    ['short', 'Short1!', ['TOO_SHORT']],
    ['common', 'password1', ['COMMON']],
    ['containing the email', 'myparent-login-9', ['CONTAINS_EMAIL']],
  ])('rejects a %s password with WEAK_PASSWORD reasons', async (_label, password, reasons) => {
    const response = await register({ email: 'myparent@example.com', password }).expect(400);

    expect(ProblemSchema.parse(response.body)).toMatchObject({ code: 'WEAK_PASSWORD', reasons });
  });

  it('rejects unknown zones and invalid fields', async () => {
    expect((await register({ timezone: 'Mars/Olympus' }).expect(400)).body).toMatchObject({
      code: 'INVALID_TIMEZONE',
    });
    expect((await register({ email: 'not-an-email' }).expect(400)).body).toMatchObject({
      code: 'VALIDATION_FAILED',
      errors: [{ path: 'email', message: expect.any(String) }],
    });
  });
});

describe('POST /auth/login', () => {
  it('signs in with the right password', async () => {
    const { email } = await signedUp();

    const response = await login(email.toUpperCase()).expect(200);

    expect(AuthResponseSchema.parse(response.body).user.email).toBe(email);
    expect(refreshCookie(response.headers)?.value).toBeDefined();
  });

  it('answers a wrong password and an unknown email identically', async () => {
    const { email } = await signedUp();

    const wrong = await login(email, 'not-the-password').expect(401);
    const unknown = await login('nobody@example.com').expect(401);

    const strip = (body: Record<string, unknown>) => ({ ...body, traceId: undefined });
    expect(strip(wrong.body as Record<string, unknown>)).toEqual(
      strip(unknown.body as Record<string, unknown>),
    );
    expect(wrong.body).toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(refreshCookie(wrong.headers)).toBeUndefined();
  });

  it('locks the account for 15 minutes after 10 failures and reports when to retry', async () => {
    const { email } = await signedUp();
    for (let attempt = 1; attempt <= 9; attempt += 1) {
      await login(email, 'wrong-password').expect(401);
      clock.advance({ seconds: 30 });
    }

    const tenth = await login(email, 'wrong-password').expect(429);
    const whileLocked = await login(email).expect(429);

    expect(ProblemSchema.parse(tenth.body)).toMatchObject({
      code: 'ACCOUNT_TEMPORARILY_LOCKED',
      retryAfterSeconds: 900,
    });
    expect(tenth.headers['retry-after']).toBe('900');
    expect(whileLocked.body).toMatchObject({ code: 'ACCOUNT_TEMPORARILY_LOCKED' });

    clock.advance({ minutes: 15 });
    await login(email).expect(200);
  });

  it('forgets old failures once the 15-minute window has passed', async () => {
    const { email } = await signedUp();
    for (let attempt = 1; attempt <= 9; attempt += 1)
      await login(email, 'wrong-password').expect(401);

    clock.advance({ minutes: 16 });

    await login(email, 'wrong-password').expect(401);
    await login(email).expect(200);
  });

  it('clears the failure count after a successful login', async () => {
    const { email } = await signedUp();
    for (let attempt = 1; attempt <= 9; attempt += 1)
      await login(email, 'wrong-password').expect(401);

    await login(email).expect(200);
    await login(email, 'wrong-password').expect(401);

    const user = single<{ failed_login_attempts: number }>(
      await db.query(`SELECT failed_login_attempts FROM users WHERE email = $1`, [email]),
    );
    expect(user.failed_login_attempts).toBe(1);
  });

  it('upgrades an outdated password hash on login', async () => {
    const { email } = await signedUp();
    const { hash, argon2id } = await import('argon2');
    const weak = await hash(PASSWORD, { type: argon2id, memoryCost: 8192, timeCost: 1 });
    await db.query(`UPDATE users SET password_hash = $1 WHERE email = $2`, [weak, email]);

    await login(email).expect(200);

    const user = single<{ password_hash: string }>(
      await db.query(`SELECT password_hash FROM users WHERE email = $1`, [email]),
    );
    expect(user.password_hash).toMatch(/m=19456,p=1,t=2/);
  });
});

describe('access tokens', () => {
  it('open protected routes and expire after 15 minutes', async () => {
    const { accessToken } = await signedUp();

    await me(accessToken).expect(200);
    clock.advance({ minutes: 14, seconds: 59 });
    await me(accessToken).expect(200);
    clock.advance({ seconds: 1 });
    const expired = await me(accessToken).expect(401);

    expect(expired.body).toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('are required on protected routes', async () => {
    expect((await api(app).get('/api/v1/me').expect(401)).body).toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    await api(app).get('/api/v1/me').set('Authorization', 'Basic abc').expect(401);
  });

  it('are rejected when tampered with, forged or meant for another audience', async () => {
    const { accessToken } = await signedUp();
    const [header, payload, signature] = accessToken.split('.');
    const jwt = new JwtService();
    const nowSeconds = Math.floor(clock.now().epochMilliseconds / 1000);
    const claims = JSON.parse(Buffer.from(payload ?? '', 'base64url').toString()) as Record<
      string,
      unknown
    >;

    const tampered = `${header}.${Buffer.from(JSON.stringify({ ...claims, sub: '00000000-0000-4000-8000-000000000000' })).toString('base64url')}.${signature}`;
    const forged = jwt.sign(
      { ...claims, iat: nowSeconds },
      { secret: 'another-secret-that-is-32-bytes-long!!', algorithm: 'HS256' },
    );
    const otherAudience = jwt.sign(
      { sub: claims.sub, sid: claims.sid, role: 'PARENT', iat: nowSeconds },
      {
        secret: TEST_JWT_SECRET,
        expiresIn: 900,
        issuer: ACCESS_TOKEN_ISSUER,
        audience: 'someone-else',
      },
    );
    const unsigned = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${payload}.`;

    for (const token of [tampered, forged, otherAudience, unsigned]) await me(token).expect(401);
    const valid = jwt.sign(
      { sub: claims.sub, sid: claims.sid, role: 'PARENT', iat: nowSeconds },
      {
        secret: TEST_JWT_SECRET,
        expiresIn: 900,
        issuer: ACCESS_TOKEN_ISSUER,
        audience: ACCESS_TOKEN_AUDIENCE,
      },
    );
    await me(valid).expect(200);
  });
});

describe('POST /auth/refresh', () => {
  it('requires the X-Requested-With header (CSRF)', async () => {
    const { refreshToken } = await signedUp();

    const response = await api(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookieHeader(refreshToken))
      .expect(400);

    expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('needs the refresh cookie', async () => {
    const response = await api(app)
      .post('/api/v1/auth/refresh')
      .set(...REQUESTED_WITH)
      .expect(401);

    expect(response.body).toMatchObject({ code: 'REFRESH_TOKEN_INVALID' });
  });

  it('rotates the refresh token and issues a new access token', async () => {
    const { refreshToken } = await signedUp();
    clock.advance({ minutes: 20 });

    const response = await refresh(refreshToken).expect(200);

    const body = RefreshResponseSchema.parse(response.body);
    const rotated = refreshCookie(response.headers)?.value;
    expect(rotated).toBeDefined();
    expect(rotated).not.toBe(refreshToken);
    await me(body.accessToken).expect(200);
  });

  it('tolerates two tabs refreshing with the same token at once (E-18)', async () => {
    const { refreshToken } = await signedUp();

    const [first, second] = await Promise.all([refresh(refreshToken), refresh(refreshToken)]);

    expect([first.status, second.status]).toEqual([200, 200]);
  });

  it('accepts the previous token within the 20-second grace window', async () => {
    const { refreshToken } = await signedUp();
    await refresh(refreshToken).expect(200);
    clock.advance({ seconds: 20 });

    await refresh(refreshToken).expect(200);
  });

  it('revokes the whole session when a rotated token is replayed later (E-19)', async () => {
    const { refreshToken } = await signedUp();
    const rotated = requireRefreshCookie((await refresh(refreshToken).expect(200)).headers).value;
    clock.advance({ seconds: 21 });

    const replay = await refresh(refreshToken).expect(401);
    const legitimate = await refresh(rotated).expect(401);

    expect(replay.body).toMatchObject({ code: 'REFRESH_TOKEN_REUSED' });
    expect(legitimate.body).toMatchObject({ code: 'REFRESH_TOKEN_INVALID' });
    expect(refreshCookie(replay.headers)?.attributes.get('expires')).toContain('1970');
    const session = single<{ revoke_reason: string }>(
      await db.query(`SELECT revoke_reason FROM auth_sessions`),
    );
    expect(session.revoke_reason).toBe('REUSE_DETECTED');
  });

  it('rejects an expired refresh token', async () => {
    const { refreshToken } = await signedUp();
    clock.advance({ hours: 168 });

    expect((await refresh(refreshToken).expect(401)).body).toMatchObject({
      code: 'REFRESH_TOKEN_INVALID',
    });
  });

  it('ends the session after the 30-day cap however often it is refreshed', async () => {
    let { refreshToken } = await signedUp();
    for (let day = 6; day < 30; day += 6) {
      clock.advance({ hours: 144 });
      refreshToken = requireRefreshCookie((await refresh(refreshToken).expect(200)).headers).value;
    }
    const cookie = requireRefreshCookie((await refresh(refreshToken).expect(200)).headers);
    // The last token is capped to the session end, 30 days after login.
    expect(Number(cookie.attributes.get('max-age'))).toBeLessThanOrEqual(6 * 24 * 3600);

    clock.advance({ hours: 144 });
    await refresh(cookie.value).expect(401);
  });
});

describe('POST /auth/logout', () => {
  it('revokes the session and clears the cookie', async () => {
    const { refreshToken } = await signedUp();

    const response = await api(app)
      .post('/api/v1/auth/logout')
      .set(...REQUESTED_WITH)
      .set('Cookie', cookieHeader(refreshToken))
      .expect(204);

    expect(refreshCookie(response.headers)?.value).toBe('');
    expect((await refresh(refreshToken).expect(401)).body).toMatchObject({
      code: 'REFRESH_TOKEN_INVALID',
    });
  });

  it('is idempotent without a cookie', async () => {
    await api(app)
      .post('/api/v1/auth/logout')
      .set(...REQUESTED_WITH)
      .expect(204);
  });

  it('requires the X-Requested-With header', async () => {
    await api(app).post('/api/v1/auth/logout').expect(400);
  });
});
