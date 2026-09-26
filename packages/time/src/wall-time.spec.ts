import { describe, expect, it } from 'vitest';

import { isoInstant } from './instant.js';
import { parseWallTime, wallTimeToInstant, wallWindowToInstants } from './wall-time.js';

function window(date: string, start: string, end: string, zone: string) {
  const result = wallWindowToInstants(date, start, end, zone);
  return result && { start: isoInstant(result.start), end: isoInstant(result.end) };
}

describe('parseWallTime', () => {
  it('accepts HH:MM and HH:MM:SS', () => {
    expect(parseWallTime('19:00').toString()).toBe('19:00:00');
    expect(parseWallTime('23:59:30').toString()).toBe('23:59:30');
  });

  it.each(['7:00', '24:00', '19:60', '19:00Z', ''])('rejects %j', (value) => {
    expect(() => parseWallTime(value)).toThrow(RangeError);
  });
});

describe('wallWindowToInstants: IST mentor (no DST)', () => {
  it('converts an evening window', () => {
    expect(window('2026-10-24', '19:00', '23:00', 'Asia/Kolkata')).toEqual({
      start: '2026-10-24T13:30:00Z',
      end: '2026-10-24T17:30:00Z',
    });
  });

  it('crosses midnight when the end is not after the start', () => {
    expect(window('2026-10-24', '22:00', '02:00', 'Asia/Kolkata')).toEqual({
      start: '2026-10-24T16:30:00Z',
      end: '2026-10-24T20:30:00Z',
    });
  });

  it('treats equal start and end as a full day', () => {
    expect(window('2026-10-24', '09:00', '09:00', 'Asia/Kolkata')).toEqual({
      start: '2026-10-24T03:30:00Z',
      end: '2026-10-25T03:30:00Z',
    });
  });
});

describe('wallWindowToInstants: US mentor across US transitions', () => {
  it('keeps 18:00 to 20:00 wall time on both sides of spring-forward (8 Mar 2026)', () => {
    expect(window('2026-03-07', '18:00', '20:00', 'America/New_York')).toEqual({
      start: '2026-03-07T23:00:00Z',
      end: '2026-03-08T01:00:00Z',
    });
    expect(window('2026-03-08', '18:00', '20:00', 'America/New_York')).toEqual({
      start: '2026-03-08T22:00:00Z',
      end: '2026-03-09T00:00:00Z',
    });
  });

  it('keeps 18:00 to 20:00 wall time on both sides of fall-back (1 Nov 2026)', () => {
    expect(window('2026-10-31', '18:00', '20:00', 'America/New_York')).toEqual({
      start: '2026-10-31T22:00:00Z',
      end: '2026-11-01T00:00:00Z',
    });
    expect(window('2026-11-01', '18:00', '20:00', 'America/New_York')).toEqual({
      start: '2026-11-01T23:00:00Z',
      end: '2026-11-02T01:00:00Z',
    });
  });

  it('a window spanning the spring-forward gap is one hour shorter in real time', () => {
    expect(window('2026-03-08', '01:00', '04:00', 'America/New_York')).toEqual({
      start: '2026-03-08T06:00:00Z',
      end: '2026-03-08T08:00:00Z',
    });
  });

  it('a window spanning the fall-back overlap is one hour longer in real time', () => {
    expect(window('2026-11-01', '00:30', '02:30', 'America/New_York')).toEqual({
      start: '2026-11-01T04:30:00Z',
      end: '2026-11-01T07:30:00Z',
    });
  });
});

describe('wallWindowToInstants: UK transitions (29 Mar and 25 Oct 2026)', () => {
  it('moves a start inside the gap forward to the first valid instant (02:00 BST)', () => {
    expect(window('2026-03-29', '01:30', '03:00', 'Europe/London')).toEqual({
      start: '2026-03-29T01:00:00Z',
      end: '2026-03-29T02:00:00Z',
    });
  });

  it('clips an end inside the gap to where the gap starts', () => {
    expect(window('2026-03-29', '00:00', '01:30', 'Europe/London')).toEqual({
      start: '2026-03-29T00:00:00Z',
      end: '2026-03-29T01:00:00Z',
    });
  });

  it('produces nothing for a window entirely inside the gap', () => {
    expect(window('2026-03-29', '01:10', '01:50', 'Europe/London')).toBeNull();
  });

  it('takes the earlier occurrence for a start and the later for an end in the overlap', () => {
    expect(window('2026-10-25', '01:30', '01:45', 'Europe/London')).toEqual({
      start: '2026-10-25T00:30:00Z',
      end: '2026-10-25T01:45:00Z',
    });
    expect(window('2026-10-25', '00:00', '01:30', 'Europe/London')).toEqual({
      start: '2026-10-24T23:00:00Z',
      end: '2026-10-25T01:30:00Z',
    });
  });

  it('handles a midnight-crossing window that ends in the overlap', () => {
    expect(window('2026-10-24', '22:00', '01:30', 'Europe/London')).toEqual({
      start: '2026-10-24T21:00:00Z',
      end: '2026-10-25T01:30:00Z',
    });
  });
});

describe('wallTimeToInstant', () => {
  it('resolves unambiguous times the same for both edges', () => {
    const start = wallTimeToInstant('2026-10-24', '19:00', 'Asia/Kolkata', 'start');
    const end = wallTimeToInstant('2026-10-24', '19:00', 'Asia/Kolkata', 'end');

    expect(start.equals(end)).toBe(true);
  });

  it('rejects impossible dates', () => {
    expect(() => wallTimeToInstant('2026-02-30', '19:00', 'Asia/Kolkata', 'start')).toThrow(
      RangeError,
    );
  });
});
