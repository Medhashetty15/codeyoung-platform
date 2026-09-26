import { ThrottlerStorageService } from '@nestjs/throttler';
import { afterEach, describe, expect, it } from 'vitest';

import { AppConfig } from '../../config/app-config';
import { AppError } from '../errors/app-error';

import { KeyedRateLimiter } from './keyed-rate-limiter';

const LIMIT = { name: 'login-email', limit: 2, ttlMs: 60_000 };

function limiter(multiplier = '1') {
  const storage = new ThrottlerStorageService();
  const config = AppConfig.fromEnv({
    DATABASE_URL: 'postgres://u:p@localhost:5432/db',
    JWT_ACCESS_SECRET: 'unit-test-secret-at-least-32-bytes-long',
    RATE_LIMIT_MULTIPLIER: multiplier,
  });
  return { storage, limiter: new KeyedRateLimiter(storage, config) };
}

describe('KeyedRateLimiter', () => {
  const storages: ThrottlerStorageService[] = [];

  afterEach(() => {
    for (const storage of storages.splice(0)) storage.onApplicationShutdown();
  });

  it('allows the limit, then answers RATE_LIMITED with Retry-After', async () => {
    const { storage, limiter: rateLimiter } = limiter();
    storages.push(storage);
    await rateLimiter.consume(LIMIT, 'hannah@okafor.co.uk');
    await rateLimiter.consume(LIMIT, 'hannah@okafor.co.uk');

    const error: unknown = await rateLimiter
      .consume(LIMIT, 'hannah@okafor.co.uk')
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: 'RATE_LIMITED' });
    expect(Number((error as AppError).headers['Retry-After'])).toBeGreaterThan(0);
  });

  it('counts each key separately', async () => {
    const { storage, limiter: rateLimiter } = limiter();
    storages.push(storage);
    await rateLimiter.consume(LIMIT, 'a@example.com');
    await rateLimiter.consume(LIMIT, 'a@example.com');

    await expect(rateLimiter.consume(LIMIT, 'b@example.com')).resolves.toBeUndefined();
  });

  it('scales with RATE_LIMIT_MULTIPLIER', async () => {
    const { storage, limiter: rateLimiter } = limiter('3');
    storages.push(storage);
    for (let hit = 0; hit < 6; hit += 1) await rateLimiter.consume(LIMIT, 'a@example.com');

    await expect(rateLimiter.consume(LIMIT, 'a@example.com')).rejects.toBeInstanceOf(AppError);
  });

  it('never keeps the email in clear text', async () => {
    const { storage, limiter: rateLimiter } = limiter();
    storages.push(storage);
    await rateLimiter.consume(LIMIT, 'hannah@okafor.co.uk');

    expect([...storage.storage.keys()].join(' ')).not.toContain('okafor');
  });
});
