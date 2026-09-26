import { type NextFunction, type Request, type Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { AppError } from '../errors/app-error';

import { translateBodyErrors } from './json-body';

function run(error: unknown): unknown {
  const next = vi.fn();
  translateBodyErrors(error, {} as Request, {} as Response, next as NextFunction);
  return next.mock.calls[0]?.[0];
}

describe('translateBodyErrors', () => {
  it.each([
    ['entity.parse.failed', 'The request body is not valid JSON.'],
    ['entity.too.large', 'The request body is too large.'],
  ])('turns %s into VALIDATION_FAILED without echoing the parser message', (type, detail) => {
    const parserError = Object.assign(new SyntaxError('Unexpected token s in "secret"'), {
      type,
      status: 400,
    });

    const forwarded = run(parserError);

    expect(forwarded).toBeInstanceOf(AppError);
    expect(forwarded).toMatchObject({ code: 'VALIDATION_FAILED', detail });
    expect((forwarded as AppError).detail).not.toContain('secret');
  });

  it('passes unrelated errors through unchanged', () => {
    const error = new Error('database down');

    expect(run(error)).toBe(error);
  });
});
