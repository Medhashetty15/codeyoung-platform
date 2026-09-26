import { describe, expect, it } from 'vitest';

import { mergeIntervals, subtractIntervals } from './intervals';

const i = (start: number, end: number) => ({ start, end });

describe('mergeIntervals', () => {
  it('sorts, joins overlapping and touching intervals, drops empty ones', () => {
    expect(mergeIntervals([i(10, 20), i(0, 5), i(5, 8), i(15, 30), i(40, 40)])).toEqual([
      i(0, 8),
      i(10, 30),
    ]);
  });

  it('does not mutate its input', () => {
    const input = [i(0, 5), i(3, 9)];
    mergeIntervals(input);

    expect(input).toEqual([i(0, 5), i(3, 9)]);
  });
});

describe('subtractIntervals', () => {
  it('cuts holes out of intervals', () => {
    expect(subtractIntervals([i(0, 100)], [i(10, 20), i(50, 60)])).toEqual([
      i(0, 10),
      i(20, 50),
      i(60, 100),
    ]);
  });

  it('handles holes at the edges, overlapping holes and holes covering everything', () => {
    expect(subtractIntervals([i(0, 100)], [i(-5, 10), i(90, 200)])).toEqual([i(10, 90)]);
    expect(subtractIntervals([i(0, 100)], [i(10, 40), i(30, 60)])).toEqual([i(0, 10), i(60, 100)]);
    expect(subtractIntervals([i(0, 100), i(200, 300)], [i(-1, 1000)])).toEqual([]);
  });

  it('keeps intervals that no hole touches', () => {
    expect(subtractIntervals([i(0, 10), i(20, 30)], [i(12, 18)])).toEqual([i(0, 10), i(20, 30)]);
  });
});
