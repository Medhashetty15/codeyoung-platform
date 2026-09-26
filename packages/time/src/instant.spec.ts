import { describe, expect, it } from 'vitest';

import {
  addMinutes,
  compareInstants,
  durationParts,
  epochMs,
  fromDate,
  instantFromEpochMs,
  isAfter,
  isBefore,
  isoInstant,
  minutesBetween,
  nowInstant,
  toDate,
  toInstant,
} from './instant.js';

describe('instants', () => {
  it('parses ISO strings with Z or an offset to the same instant', () => {
    expect(toInstant('2026-10-24T17:00:00+01:00').equals(toInstant('2026-10-24T16:00:00Z'))).toBe(
      true,
    );
  });

  it('refuses strings without an offset (no implicit local time)', () => {
    expect(() => toInstant('2026-10-24T17:00:00')).toThrow(RangeError);
  });

  it('writes the API form: UTC, second precision', () => {
    expect(isoInstant('2026-10-24T17:00:00.789+01:00')).toBe('2026-10-24T16:00:00Z');
  });

  it('round-trips through epoch milliseconds and Date', () => {
    const instant = toInstant('2026-10-24T16:00:00.250Z');

    expect(instantFromEpochMs(epochMs(instant)).equals(instant)).toBe(true);
    expect(fromDate(toDate(instant)).equals(instant)).toBe(true);
    expect(toDate(instant).toISOString()).toBe('2026-10-24T16:00:00.250Z');
  });

  it('adds minutes as exact time, ignoring DST', () => {
    // 60 minutes across London's fall-back is still 60 real minutes.
    expect(isoInstant(addMinutes('2026-10-25T00:30:00Z', 60))).toBe('2026-10-25T01:30:00Z');
  });

  it('compares instants', () => {
    const early = '2026-10-24T16:00:00Z';
    const late = '2026-10-24T16:30:00Z';

    expect(compareInstants(early, late)).toBe(-1);
    expect(compareInstants(late, early)).toBe(1);
    expect(compareInstants(early, early)).toBe(0);
    expect(isBefore(early, late)).toBe(true);
    expect(isAfter(early, late)).toBe(false);
    expect(minutesBetween(early, late)).toBe(30);
    expect(minutesBetween(late, early)).toBe(-30);
  });

  it('reads the current time', () => {
    const before = Date.now();
    const now = epochMs(nowInstant());

    expect(now).toBeGreaterThanOrEqual(before);
  });
});

describe('durationParts', () => {
  it('splits the remaining time for a countdown', () => {
    expect(durationParts('2026-10-24T16:00:00Z', '2026-10-26T19:04:05.900Z')).toEqual({
      days: 2,
      hours: 3,
      minutes: 4,
      seconds: 5,
    });
  });

  it('never goes negative', () => {
    expect(durationParts('2026-10-24T17:00:00Z', '2026-10-24T16:00:00Z')).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    });
  });
});
