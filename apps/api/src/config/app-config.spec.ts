import { describe, expect, it } from 'vitest';

import { AppConfig, ConfigValidationError } from './app-config';

const DATABASE_URL = 'postgres://codeyoung:secret@db.internal:5433/codeyoung_dev';
const JWT_ACCESS_SECRET = 'test-secret-that-is-at-least-32-bytes-long';
const BASE = { DATABASE_URL, JWT_ACCESS_SECRET };

describe('AppConfig.fromEnv', () => {
  it('applies documented defaults', () => {
    const config = AppConfig.fromEnv({ ...BASE });

    expect(config).toMatchObject({
      nodeEnv: 'development',
      port: 3000,
      webBaseUrl: 'http://localhost:5173',
      corsOrigins: ['http://localhost:5173'],
      logLevel: 'info',
      logPretty: true,
      trustProxyHops: 0,
      rateLimitMultiplier: 1,
    });
    expect(config.isProduction).toBe(false);
  });

  it('coerces numbers and booleans from strings', () => {
    const config = AppConfig.fromEnv({
      ...BASE,
      PORT: '3001',
      LOG_PRETTY: 'false',
      TRUST_PROXY_HOPS: '1',
      RATE_LIMIT_MULTIPLIER: '50',
    });

    expect(config.port).toBe(3001);
    expect(config.logPretty).toBe(false);
    expect(config.trustProxyHops).toBe(1);
    expect(config.rateLimitMultiplier).toBe(50);
  });

  it('parses the CORS allow-list and strips a trailing slash from WEB_BASE_URL', () => {
    const config = AppConfig.fromEnv({
      ...BASE,
      WEB_BASE_URL: 'https://app.codeyoung.dev/',
      CORS_ORIGINS: 'https://app.codeyoung.dev, https://staging.codeyoung.dev ,',
    });

    expect(config.webBaseUrl).toBe('https://app.codeyoung.dev');
    expect(config.corsOrigins).toEqual([
      'https://app.codeyoung.dev',
      'https://staging.codeyoung.dev',
    ]);
  });

  it('defaults the CORS allow-list to the web origin only', () => {
    const config = AppConfig.fromEnv({
      ...BASE,
      WEB_BASE_URL: 'https://app.codeyoung.dev/app',
    });

    expect(config.corsOrigins).toEqual(['https://app.codeyoung.dev']);
  });

  it('lists every invalid key without echoing values', () => {
    const attempt = () =>
      AppConfig.fromEnv({
        DATABASE_URL: 'mysql://root:hunter2@db/x',
        PORT: '0',
        LOG_LEVEL: 'loud',
      });

    expect(attempt).toThrow(ConfigValidationError);
    expect(attempt).toThrow(/DATABASE_URL/);
    expect(attempt).toThrow(/PORT/);
    expect(attempt).toThrow(/LOG_LEVEL/);
    expect(attempt).not.toThrow(/hunter2/);
  });

  it('requires DATABASE_URL', () => {
    expect(() => AppConfig.fromEnv({})).toThrow(/DATABASE_URL/);
  });

  it('refuses relaxed rate limits in production', () => {
    expect(() =>
      AppConfig.fromEnv({ ...BASE, NODE_ENV: 'production', RATE_LIMIT_MULTIPLIER: '10' }),
    ).toThrow(/RATE_LIMIT_MULTIPLIER/);
    expect(
      AppConfig.fromEnv({
        ...BASE,
        NODE_ENV: 'production',
        RATE_LIMIT_MULTIPLIER: '1',
        SMTP_URL: 'smtp://mail.example.com:587',
      }).isProduction,
    ).toBe(true);
  });

  it('scales rate limits and never returns less than one request', () => {
    expect(AppConfig.fromEnv({ ...BASE, RATE_LIMIT_MULTIPLIER: '100' }).scaledLimit(5)).toBe(500);
    expect(AppConfig.fromEnv({ ...BASE, RATE_LIMIT_MULTIPLIER: '0.001' }).scaledLimit(5)).toBe(1);
  });

  it('applies the documented auth defaults', () => {
    expect(AppConfig.fromEnv(BASE).auth).toEqual({
      accessSecret: JWT_ACCESS_SECRET,
      accessTtlSeconds: 900,
      refreshTtlDays: 7,
      sessionMaxDays: 30,
      refreshReuseGraceSeconds: 20,
      passwordResetTtlMinutes: 30,
      loginLockThreshold: 10,
      loginLockMinutes: 15,
      cookieSecure: true,
    });
  });

  it('applies the documented booking defaults', () => {
    expect(AppConfig.fromEnv(BASE).booking).toEqual({
      trialDurationMinutes: 60,
      slotGridMinutes: 30,
      mentorBufferMinutes: 15,
      leadTimeMinutes: 240,
      horizonDays: 14,
      rescheduleCutoffMinutes: 120,
      defaultMaxTrialsPerDay: 2,
      classroomOpensMinutesBefore: 10,
      mentorDisplayTimezone: 'Asia/Kolkata',
    });
  });

  it('keeps the slot grid consistent with days and class length', () => {
    expect(() => AppConfig.fromEnv({ ...BASE, SLOT_GRID_MIN: '35' })).toThrow(/SLOT_GRID_MIN/);
    expect(() => AppConfig.fromEnv({ ...BASE, TRIAL_DURATION_MIN: '45' })).toThrow(
      /TRIAL_DURATION_MIN/,
    );
  });

  it('canonicalises the mentor display zone', () => {
    expect(
      AppConfig.fromEnv({ ...BASE, MENTOR_DISPLAY_TIMEZONE: 'Asia/Calcutta' }).booking
        .mentorDisplayTimezone,
    ).toBe('Asia/Kolkata');
    expect(() => AppConfig.fromEnv({ ...BASE, MENTOR_DISPLAY_TIMEZONE: 'Mars/Olympus' })).toThrow(
      /MENTOR_DISPLAY_TIMEZONE/,
    );
  });

  it('requires a long JWT secret without echoing it', () => {
    const attempt = () => AppConfig.fromEnv({ DATABASE_URL, JWT_ACCESS_SECRET: 'short-secret' });

    expect(attempt).toThrow(/JWT_ACCESS_SECRET/);
    expect(attempt).not.toThrow(/short-secret/);
  });

  it('allows an insecure cookie for local http only', () => {
    expect(AppConfig.fromEnv({ ...BASE, COOKIE_SECURE: 'false' }).auth.cookieSecure).toBe(false);
    expect(() =>
      AppConfig.fromEnv({ ...BASE, NODE_ENV: 'production', COOKIE_SECURE: 'false' }),
    ).toThrow(/COOKIE_SECURE/);
  });

  it('keeps refresh tokens within the session cap', () => {
    expect(() =>
      AppConfig.fromEnv({ ...BASE, REFRESH_TTL_DAYS: '14', SESSION_MAX_DAYS: '7' }),
    ).toThrow(/REFRESH_TTL_DAYS/);
  });

  it('applies the documented mail and outbox defaults', () => {
    const config = AppConfig.fromEnv({ ...BASE });

    expect(config.mail).toEqual({
      smtpUrl: 'smtp://localhost:1025',
      from: { name: 'Codeyoung', email: 'trials@codeyoung.dev' },
    });
    expect(config.outbox).toEqual({ pollMs: 2000, maxAttempts: 8 });
  });

  it('accepts a bare sender address and rejects a malformed one', () => {
    expect(AppConfig.fromEnv({ ...BASE, MAIL_FROM: 'ops@example.com' }).mail.from).toEqual({
      name: '',
      email: 'ops@example.com',
    });
    expect(() => AppConfig.fromEnv({ ...BASE, MAIL_FROM: 'Codeyoung <nowhere>' })).toThrow(
      /MAIL_FROM/,
    );
  });

  it('requires an explicit SMTP server in production', () => {
    const production = { ...BASE, NODE_ENV: 'production' };

    expect(() => AppConfig.fromEnv(production)).toThrow(/SMTP_URL/);
    expect(
      AppConfig.fromEnv({ ...production, SMTP_URL: 'smtps://mail.example.com:465' }).mail.smtpUrl,
    ).toBe('smtps://mail.example.com:465');
  });

  it('describes itself without the database password', () => {
    const description = JSON.stringify(AppConfig.fromEnv({ ...BASE }).describe());

    expect(description).toContain('postgres://db.internal:5433/codeyoung_dev');
    expect(description).not.toContain('secret');
    expect(description).not.toContain('codeyoung:');
    expect(description).not.toContain(JWT_ACCESS_SECRET);
  });

  it('describes the SMTP server without its password', () => {
    const description = JSON.stringify(
      AppConfig.fromEnv({
        ...BASE,
        SMTP_URL: 'smtps://mailer:hunter22@mail.example.com:465',
      }).describe(),
    );

    expect(description).toContain('mail.example.com');
    expect(description).not.toContain('hunter22');
  });
});
