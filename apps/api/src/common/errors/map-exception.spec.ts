import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { ZodValidationException } from 'nestjs-zod';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ErrorCode } from '@app/contracts';

import { AppError } from './app-error';
import { fieldErrors, mapException } from './map-exception';

describe('mapException', () => {
  it('keeps the code, detail, extras and headers of an AppError', () => {
    const error = new AppError(ErrorCode.NO_MENTOR_AVAILABLE, {
      detail: 'This time was just taken.',
      extras: { alternatives: [] },
    });

    expect(mapException(error)).toEqual({
      code: 'NO_MENTOR_AVAILABLE',
      status: 409,
      detail: 'This time was just taken.',
      extras: { alternatives: [] },
      headers: {},
      unexpected: false,
    });
  });

  it('uses the documented status for the code, not a caller-chosen one', () => {
    const mapped = mapException(
      new AppError(ErrorCode.ACCOUNT_TEMPORARILY_LOCKED, { headers: { 'Retry-After': '900' } }),
    );

    expect(mapped.status).toBe(429);
    expect(mapped.headers).toEqual({ 'Retry-After': '900' });
  });

  it('reports zod validation failures with dotted field paths', () => {
    const schema = z.object({ student: z.object({ firstName: z.string().min(1) }), age: z.int() });
    const result = schema.safeParse({ student: { firstName: '' }, age: 4.5 });
    if (result.success) throw new Error('fixture must be invalid');

    const mapped = mapException(new ZodValidationException(result.error));

    expect(mapped.code).toBe('VALIDATION_FAILED');
    expect(mapped.status).toBe(400);
    expect(mapped.extras.errors).toEqual([
      { path: 'student.firstName', message: expect.any(String) },
      { path: 'age', message: expect.any(String) },
    ]);
  });

  it('maps the throttler to RATE_LIMITED', () => {
    expect(mapException(new ThrottlerException())).toMatchObject({
      code: 'RATE_LIMITED',
      status: 429,
    });
  });

  it.each([
    [new UnauthorizedException(), 'UNAUTHENTICATED', 401],
    [new NotFoundException('Cannot GET /api/v1/nope'), 'NOT_FOUND', 404],
    [new ForbiddenException(), 'NOT_FOUND', 404],
    [new HttpException('Too many', 429), 'RATE_LIMITED', 429],
    [new BadRequestException('Validation failed (uuid is expected)'), 'VALIDATION_FAILED', 400],
    [new HttpException('Unsupported Media Type', 415), 'VALIDATION_FAILED', 400],
  ])('maps %s to %s', (exception, code, status) => {
    expect(mapException(exception)).toMatchObject({ code, status, unexpected: false });
  });

  it('asks clients to retry a 503 later', () => {
    expect(mapException(new ServiceUnavailableException())).toMatchObject({
      code: 'TEMPORARILY_UNAVAILABLE',
      status: 503,
      headers: { 'Retry-After': '5' },
    });
  });

  it('hides unexpected errors behind INTERNAL_ERROR', () => {
    const mapped = mapException(
      new Error('duplicate key value violates unique constraint "users_email_key"'),
    );

    expect(mapped).toEqual({
      code: 'INTERNAL_ERROR',
      status: 500,
      extras: {},
      headers: {},
      unexpected: true,
    });
  });

  it('treats 5xx HttpExceptions and thrown non-errors as unexpected', () => {
    expect(mapException(new HttpException('boom', 502)).unexpected).toBe(true);
    expect(mapException('a string').unexpected).toBe(true);
    expect(mapException(undefined).code).toBe('INTERNAL_ERROR');
  });
});

describe('fieldErrors', () => {
  it('returns nothing for values that are not zod errors', () => {
    expect(fieldErrors(new Error('nope'))).toEqual([]);
    expect(fieldErrors(null)).toEqual([]);
  });
});
