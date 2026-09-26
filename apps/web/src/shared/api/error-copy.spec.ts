import { describe, expect, it } from 'vitest';

import { ApiError } from './ApiError';
import { tooManyAttemptsText, unreachableText, waitText } from './error-copy';

describe('error copy', () => {
  it.each([
    [0, '1 second'],
    [1, '1 second'],
    [30, '30 seconds'],
    [59.2, '60 seconds'],
    [60, '1 minute'],
    [61, '2 minutes'],
    [720, '12 minutes'],
  ])('waitText(%d) is %j', (seconds, expected) => {
    expect(waitText(seconds)).toBe(expected);
  });

  it('prefers retryAfterSeconds from the problem body', () => {
    const locked = new ApiError(
      429,
      'ACCOUNT_TEMPORARILY_LOCKED',
      'Locked',
      undefined,
      [],
      5,
      undefined,
      {
        retryAfterSeconds: 720,
      },
    );
    expect(tooManyAttemptsText(locked)).toBe('Too many attempts. Try again in 12 minutes.');
    const limited = new ApiError(429, 'RATE_LIMITED', 'Slow down', undefined, [], 30);
    expect(tooManyAttemptsText(limited)).toBe('Too many attempts. Try again in 30 seconds.');
  });

  it('adds the support reference when there is one', () => {
    const error = new ApiError(
      503,
      'TEMPORARILY_UNAVAILABLE',
      'Busy',
      undefined,
      [],
      undefined,
      '7f3a91c2ab',
    );
    expect(unreachableText(error)).toBe(
      "We couldn't reach our servers. Check your connection and try again. Reference: 7F3A-91C2",
    );
    expect(unreachableText(new Error('boom'))).toBe(
      "We couldn't reach our servers. Check your connection and try again.",
    );
  });
});
