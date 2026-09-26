import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { InjectThrottlerStorage, ThrottlerStorage } from '@nestjs/throttler';

import { ErrorCode } from '@app/contracts';

import { AppConfig } from '../../config/app-config';
import { AppError } from '../errors/app-error';

export interface KeyedLimit {
  /** Bucket name, e.g. `login-email`. */
  name: string;
  limit: number;
  ttlMs: number;
}

/**
 * Rate limits keyed by something other than the client IP (e.g. the email a
 * login targets, docs/03 §6.5). Shares the throttler's storage; keys are
 * hashed so no email sits in memory in clear text.
 */
@Injectable()
export class KeyedRateLimiter {
  constructor(
    @InjectThrottlerStorage() private readonly storage: ThrottlerStorage,
    private readonly config: AppConfig,
  ) {}

  /** Counts one hit for `key`; throws RATE_LIMITED with Retry-After once over the limit. */
  async consume(limit: KeyedLimit, key: string): Promise<void> {
    const hashed = createHash('sha256').update(`${limit.name}:${key}`).digest('hex');
    const max = this.config.scaledLimit(limit.limit);
    // No block duration: the window simply runs out, like the documented "N per period" limits.
    const record = await this.storage.increment(hashed, limit.ttlMs, max, 0, limit.name);
    if (record.totalHits > max) {
      const retryAfter = Math.max(1, record.timeToExpire);
      throw new AppError(ErrorCode.RATE_LIMITED, {
        detail: 'Too many attempts. Please wait before trying again.',
        headers: { 'Retry-After': String(retryAfter) },
      });
    }
  }
}
