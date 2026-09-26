import { describe, expect, it } from 'vitest';

import { initialsOf } from './initials';

describe('initialsOf', () => {
  it.each([
    ['Priya Raghavan', 'PR'],
    ['  hannah   okafor ', 'HO'],
    ['Leo', 'L'],
    ['Ananya Iyer Krishnan', 'AK'],
    ['', ''],
  ])('%j -> %j', (name, expected) => {
    expect(initialsOf(name)).toBe(expected);
  });
});
