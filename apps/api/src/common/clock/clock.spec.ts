import { describe, expect, it } from 'vitest';

import { Temporal } from '@app/time';

import { SystemClock } from './clock';

describe('SystemClock', () => {
  it('returns the current instant', () => {
    const before = Temporal.Now.instant();
    const now = new SystemClock().now();
    const after = Temporal.Now.instant();

    expect(Temporal.Instant.compare(before, now)).toBeLessThanOrEqual(0);
    expect(Temporal.Instant.compare(now, after)).toBeLessThanOrEqual(0);
  });
});
