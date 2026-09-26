import { describe, expect, it } from 'vitest';

import {
  ErrorCode,
  errorCodeSchema,
  errorCodeStatus,
  errorTypeUri,
  problemDetailsSchema,
} from './errors.js';

describe('ErrorCode', () => {
  it('has a documented HTTP status for every code', () => {
    expect(Object.keys(errorCodeStatus).sort()).toEqual(Object.values(ErrorCode).sort());
  });

  it('maps statuses as documented in docs/03 §9', () => {
    expect(errorCodeStatus.VALIDATION_FAILED).toBe(400);
    expect(errorCodeStatus.INVALID_CREDENTIALS).toBe(401);
    expect(errorCodeStatus.BOOKING_NOT_FOUND).toBe(404);
    expect(errorCodeStatus.NO_MENTOR_AVAILABLE).toBe(409);
    expect(errorCodeStatus.SLOT_IN_PAST).toBe(422);
    expect(errorCodeStatus.ACCOUNT_TEMPORARILY_LOCKED).toBe(429);
    expect(errorCodeStatus.INTERNAL_ERROR).toBe(500);
    expect(errorCodeStatus.TEMPORARILY_UNAVAILABLE).toBe(503);
  });

  it('rejects unknown codes', () => {
    expect(errorCodeSchema.safeParse('TEAPOT').success).toBe(false);
  });
});

describe('errorTypeUri', () => {
  it('derives a kebab-case URI from the code', () => {
    expect(errorTypeUri(ErrorCode.NO_MENTOR_AVAILABLE)).toBe(
      'https://errors.codeyoung.dev/no-mentor-available',
    );
  });
});

describe('problemDetailsSchema', () => {
  it('accepts a problem with field errors and keeps code-specific members', () => {
    const problem = {
      type: errorTypeUri(ErrorCode.VALIDATION_FAILED),
      title: 'The request is not valid',
      status: 400,
      code: 'VALIDATION_FAILED',
      traceId: 'trace-12345678',
      errors: [{ path: 'student.firstName', message: 'Required' }],
      extra: true,
    };

    expect(problemDetailsSchema.parse(problem)).toEqual(problem);
  });

  it('requires a traceId', () => {
    expect(
      problemDetailsSchema.safeParse({ type: 'x', title: 'x', status: 500, code: 'INTERNAL_ERROR' })
        .success,
    ).toBe(false);
  });
});
