import { describe, expect, it } from 'vitest';

import { AppConfig, ConfigValidationError } from './app-config';

const DATABASE_URL = 'postgres://codeyoung:secret@db.internal:5433/codeyoung_dev';

describe('AppConfig.fromEnv', () => {
  it('applies documented defaults', () => {
    const config = AppConfig.fromEnv({ DATABASE_URL });

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
      DATABASE_URL,
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
      DATABASE_URL,
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
      DATABASE_URL,
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
      AppConfig.fromEnv({ DATABASE_URL, NODE_ENV: 'production', RATE_LIMIT_MULTIPLIER: '10' }),
    ).toThrow(/RATE_LIMIT_MULTIPLIER/);
    expect(
      AppConfig.fromEnv({ DATABASE_URL, NODE_ENV: 'production', RATE_LIMIT_MULTIPLIER: '1' })
        .isProduction,
    ).toBe(true);
  });

  it('scales rate limits and never returns less than one request', () => {
    expect(AppConfig.fromEnv({ DATABASE_URL, RATE_LIMIT_MULTIPLIER: '100' }).scaledLimit(5)).toBe(
      500,
    );
    expect(AppConfig.fromEnv({ DATABASE_URL, RATE_LIMIT_MULTIPLIER: '0.001' }).scaledLimit(5)).toBe(
      1,
    );
  });

  it('describes itself without the database password', () => {
    const description = JSON.stringify(AppConfig.fromEnv({ DATABASE_URL }).describe());

    expect(description).toContain('postgres://db.internal:5433/codeyoung_dev');
    expect(description).not.toContain('secret');
    expect(description).not.toContain('codeyoung:');
  });
});
