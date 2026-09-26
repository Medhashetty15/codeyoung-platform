import { describe, expect, it } from 'vitest';

import { count } from './count';

describe('count', () => {
  it('uses the singular for exactly one', () => {
    expect(count(1, 'booking')).toBe('1 booking');
    expect(count(0, 'booking')).toBe('0 bookings');
    expect(count(2, 'child', 'children')).toBe('2 children');
    expect(count(1, 'child', 'children')).toBe('1 child');
  });
});
