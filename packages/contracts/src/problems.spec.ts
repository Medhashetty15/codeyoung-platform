import { describe, expect, it } from 'vitest';

import { ErrorCode, errorCodeStatus, errorTitles, errorTypeUri } from './errors.js';
import { ProblemSchema } from './problems.js';

function problem(code: ErrorCode, extras: Record<string, unknown> = {}) {
  return {
    type: errorTypeUri(code),
    title: errorTitles[code],
    status: errorCodeStatus[code],
    code,
    traceId: 'trace-12345678',
    ...extras,
  };
}

describe('ProblemSchema', () => {
  it('narrows by code to the members that code carries', () => {
    const parsed = ProblemSchema.parse(
      problem(ErrorCode.NO_MENTOR_AVAILABLE, {
        alternatives: [{ start: '2026-10-24T17:00:00Z', end: '2026-10-24T18:00:00Z' }],
      }),
    );

    if (parsed.code !== 'NO_MENTOR_AVAILABLE') throw new Error('expected narrowing');
    expect(parsed.alternatives).toHaveLength(1);
  });

  it.each([
    [ErrorCode.VALIDATION_FAILED, { errors: [{ path: 'email', message: 'Invalid email' }] }],
    [ErrorCode.WEAK_PASSWORD, { reasons: ['TOO_SHORT', 'COMMON'] }],
    [ErrorCode.STUDENT_ALREADY_HAS_TRIAL, { bookingId: '0b6c3d5e-8f4a-4c1b-9d2e-7a6b5c4d3e2f' }],
    [ErrorCode.BOOKING_NOT_MODIFIABLE, { reason: 'ALREADY_STARTED' }],
    [ErrorCode.ACCOUNT_TEMPORARILY_LOCKED, { retryAfterSeconds: 720 }],
    [ErrorCode.RATE_LIMITED, { retryAfterSeconds: 30 }],
    [ErrorCode.TEMPORARILY_UNAVAILABLE, { retryAfterSeconds: 2 }],
    [ErrorCode.INVALID_CREDENTIALS, {}],
    [ErrorCode.INVALID_TIMEZONE, { errors: [{ path: 'timezone', message: 'Unknown time zone' }] }],
    [ErrorCode.NOT_FOUND, {}],
  ] as const)('accepts %s with its members', (code, extras) => {
    expect(ProblemSchema.safeParse(problem(code, extras)).success).toBe(true);
  });

  it.each([
    [ErrorCode.VALIDATION_FAILED, {}],
    [ErrorCode.WEAK_PASSWORD, { reasons: [] }],
    [ErrorCode.NO_MENTOR_AVAILABLE, {}],
    [ErrorCode.STUDENT_ALREADY_HAS_TRIAL, { bookingId: 'nope' }],
    [ErrorCode.BOOKING_NOT_MODIFIABLE, { reason: 'BECAUSE' }],
    [ErrorCode.RATE_LIMITED, {}],
  ] as const)('rejects %s without its required members', (code, extras) => {
    expect(ProblemSchema.safeParse(problem(code, extras)).success).toBe(false);
  });

  it('caps alternatives at three', () => {
    const slot = { start: '2026-10-24T17:00:00Z', end: '2026-10-24T18:00:00Z' };

    expect(
      ProblemSchema.safeParse(
        problem(ErrorCode.NO_MENTOR_AVAILABLE, { alternatives: [slot, slot, slot, slot] }),
      ).success,
    ).toBe(false);
  });

  it('accepts every documented code', () => {
    const extras: Partial<Record<ErrorCode, Record<string, unknown>>> = {
      VALIDATION_FAILED: { errors: [] },
      WEAK_PASSWORD: { reasons: ['COMMON'] },
      NO_MENTOR_AVAILABLE: { alternatives: [] },
      STUDENT_ALREADY_HAS_TRIAL: { bookingId: '0b6c3d5e-8f4a-4c1b-9d2e-7a6b5c4d3e2f' },
      BOOKING_NOT_MODIFIABLE: { reason: 'NOT_CONFIRMED' },
      RATE_LIMITED: { retryAfterSeconds: 1 },
      ACCOUNT_TEMPORARILY_LOCKED: { retryAfterSeconds: 1 },
      TEMPORARILY_UNAVAILABLE: { retryAfterSeconds: 1 },
    };
    for (const code of Object.values(ErrorCode)) {
      expect(ProblemSchema.safeParse(problem(code, extras[code])).success, code).toBe(true);
    }
  });
});
