import { describe, expect, it } from 'vitest';

import { ErrorCode, ProblemSchema } from '@app/contracts';

import { toBody } from './problem-details.filter';

describe('toBody', () => {
  it('builds an RFC 7807 body that satisfies the shared contract', () => {
    const body = toBody(
      {
        code: ErrorCode.STUDENT_ALREADY_HAS_TRIAL,
        status: 409,
        detail: 'Maya already has a trial booked.',
        extras: { bookingId: '0b6c3d5e-8f4a-4c1b-9d2e-7a6b5c4d3e2f' },
        headers: {},
        unexpected: false,
      },
      'trace-12345678',
    );

    expect(body).toEqual({
      type: 'https://errors.codeyoung.dev/student-already-has-trial',
      title: 'This student already has an upcoming trial',
      status: 409,
      code: 'STUDENT_ALREADY_HAS_TRIAL',
      detail: 'Maya already has a trial booked.',
      bookingId: '0b6c3d5e-8f4a-4c1b-9d2e-7a6b5c4d3e2f',
      traceId: 'trace-12345678',
    });
    expect(ProblemSchema.parse(body)).toEqual(body);
  });

  it('never lets extras overwrite the standard members', () => {
    const body = toBody(
      {
        code: ErrorCode.VALIDATION_FAILED,
        status: 400,
        extras: { status: 200, code: 'OK', traceId: 'forged', title: 'fine' },
        headers: {},
        unexpected: false,
      },
      'trace-12345678',
    );

    expect(body).toMatchObject({
      status: 400,
      code: 'VALIDATION_FAILED',
      traceId: 'trace-12345678',
    });
    expect(body.title).toBe('The request is not valid');
  });

  it('omits detail when there is none', () => {
    const body = toBody(
      { code: ErrorCode.NOT_FOUND, status: 404, extras: {}, headers: {}, unexpected: false },
      'trace-12345678',
    );

    expect(body).not.toHaveProperty('detail');
  });

  it('mirrors Retry-After into retryAfterSeconds', () => {
    const body = toBody(
      { code: ErrorCode.RATE_LIMITED, status: 429, extras: {}, headers: {}, unexpected: false },
      'trace-12345678',
      42,
    );

    expect(ProblemSchema.parse(body)).toMatchObject({
      code: 'RATE_LIMITED',
      retryAfterSeconds: 42,
    });
  });
});
