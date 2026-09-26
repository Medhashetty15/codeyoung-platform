import { describe, expect, it } from 'vitest';

import { afterFailure } from './retry-policy';

describe('afterFailure', () => {
  it('backs off exponentially and caps the wait at an hour', () => {
    const delays = [1, 2, 3, 4, 5, 6, 7].map((attempts) => afterFailure(attempts, 8));

    expect(delays).toEqual(
      [2, 4, 8, 16, 32, 60, 60].map((delayMinutes) => ({ kind: 'retry', delayMinutes })),
    );
  });

  it('gives up once the attempt limit is reached', () => {
    expect(afterFailure(8, 8)).toEqual({ kind: 'dead' });
    expect(afterFailure(9, 8)).toEqual({ kind: 'dead' });
    expect(afterFailure(1, 1)).toEqual({ kind: 'dead' });
  });
});
