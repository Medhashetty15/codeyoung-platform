import { describe, expect, it } from 'vitest';

import { ErrorCode, errorCodeStatus, problemDetailsSchema } from '@app/contracts';

import { toBody } from './problem-details.filter';
import { PROBLEM_TITLES } from './problem-titles';

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
    expect(problemDetailsSchema.parse(body)).toEqual(body);
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
    expect(body.title).toBe(PROBLEM_TITLES.VALIDATION_FAILED);
  });

  it('omits detail when there is none', () => {
    const body = toBody(
      { code: ErrorCode.NOT_FOUND, status: 404, extras: {}, headers: {}, unexpected: false },
      'trace-12345678',
    );

    expect(body).not.toHaveProperty('detail');
  });
});

describe('PROBLEM_TITLES', () => {
  it('has a title for every error code', () => {
    expect(Object.keys(PROBLEM_TITLES).sort()).toEqual(Object.keys(errorCodeStatus).sort());
  });
});
