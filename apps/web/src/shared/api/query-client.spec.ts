import { describe, expect, it } from 'vitest';

import { ApiError } from './ApiError';
import { shouldRetry } from './query-client';

describe('shouldRetry', () => {
  it('retries network errors and 5xx up to twice', () => {
    const network = ApiError.network(new TypeError('failed'));
    const server = new ApiError(503, 'TEMPORARILY_UNAVAILABLE', 'Busy');
    expect(shouldRetry(0, network)).toBe(true);
    expect(shouldRetry(1, server)).toBe(true);
    expect(shouldRetry(2, server)).toBe(false);
  });

  it('never retries 4xx or unknown errors', () => {
    expect(shouldRetry(0, new ApiError(409, 'NO_MENTOR_AVAILABLE', 'Taken'))).toBe(false);
    expect(shouldRetry(0, new Error('boom'))).toBe(false);
  });
});
