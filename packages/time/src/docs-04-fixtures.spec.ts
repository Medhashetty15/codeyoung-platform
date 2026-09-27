/**
 * The fixtures docs/04-timezones-and-dst.md §7 says must pass, expressed with
 * the public API exactly as the slot engine, UI and emails use it.
 */
import { describe, expect, it } from 'vitest';

import { localDateOf, localDates } from './calendar.js';
import { formatTime } from './format.js';
import { isoInstant } from './instant.js';
import { zoneLabel } from './labels.js';
import { wallWindowToInstants } from './wall-time.js';
import { zoneOffset, zoneOffsetMinutes } from './zones.js';

const NBSP = '\u00A0';

/** Priya (Asia/Kolkata) teaches every Sunday 01:30 to 05:30 IST (docs/04 §2 worked example). */
function priyaSundaySlot(istDate: string): string {
  const window = wallWindowToInstants(istDate, '01:30', '05:30', 'Asia/Kolkata');
  if (window === null) throw new Error('window must exist');
  return isoInstant(window.start);
}

describe('docs/04 §2 worked example: same IST slot, different parent wall times', () => {
  it.each([
    [
      '2026-10-18',
      '2026-10-17T20:00:00Z',
      `4:00${NBSP}PM`,
      'Eastern Time (GMT-4)',
      `9:00${NBSP}PM`,
      'London time (GMT+1)',
    ],
    [
      '2026-10-25',
      '2026-10-24T20:00:00Z',
      `4:00${NBSP}PM`,
      'Eastern Time (GMT-4)',
      `9:00${NBSP}PM`,
      'London time (GMT+1)',
    ],
    [
      '2026-11-01',
      '2026-10-31T20:00:00Z',
      `4:00${NBSP}PM`,
      'Eastern Time (GMT-4)',
      `8:00${NBSP}PM`,
      'London time (GMT)',
    ],
    [
      '2026-11-08',
      '2026-11-07T20:00:00Z',
      `3:00${NBSP}PM`,
      'Eastern Time (GMT-5)',
      `8:00${NBSP}PM`,
      'London time (GMT)',
    ],
  ])('Sunday %s IST', (istDate, utc, nyTime, nyZone, londonTime, londonZone) => {
    const slot = priyaSundaySlot(istDate);

    expect(slot).toBe(utc);
    expect(localDateOf(slot, 'America/New_York')).toBe(localDateOf(slot, 'Europe/London'));
    expect(formatTime(slot, 'America/New_York')).toBe(nyTime);
    expect(zoneLabel('America/New_York', slot)).toBe(nyZone);
    expect(formatTime(slot, 'Europe/London')).toBe(londonTime);
    expect(zoneLabel('Europe/London', slot)).toBe(londonZone);
  });
});

describe('docs/04 §2 offsets between zones across 2026', () => {
  // ISO offsets from Temporal ('+00:00'), not Intl zone-name text: ICU releases word the
  // zero offset differently ('GMT' in ICU 77, 'GMT+00:00' in ICU 78), the offsets never change.
  const offsets = (instant: string, zone: string) =>
    `${zoneOffset(zone, instant)}|${zoneOffset('Asia/Kolkata', instant)}`;
  // How far the zone's clock is behind India's, the gap the §2 table is about.
  const behindIndiaMinutes = (instant: string, zone: string) =>
    zoneOffsetMinutes('Asia/Kolkata', instant) - zoneOffsetMinutes(zone, instant);

  it.each([
    ['2026-02-01T12:00:00Z', '-05:00|+05:30', 630, '+00:00|+05:30', 330],
    ['2026-03-15T12:00:00Z', '-04:00|+05:30', 570, '+00:00|+05:30', 330],
    ['2026-06-01T12:00:00Z', '-04:00|+05:30', 570, '+01:00|+05:30', 270],
    ['2026-10-28T12:00:00Z', '-04:00|+05:30', 570, '+00:00|+05:30', 330],
    ['2026-11-15T12:00:00Z', '-05:00|+05:30', 630, '+00:00|+05:30', 330],
  ])('at %s', (instant, newYork, newYorkBehind, london, londonBehind) => {
    expect(offsets(instant, 'America/New_York')).toBe(newYork);
    expect(behindIndiaMinutes(instant, 'America/New_York')).toBe(newYorkBehind);
    expect(offsets(instant, 'Europe/London')).toBe(london);
    expect(behindIndiaMinutes(instant, 'Europe/London')).toBe(londonBehind);
  });
});

describe('docs/04 §7 mismatch week (25 to 31 Oct 2026)', () => {
  it('renders one daily IST slot at the right NY and London times every day', () => {
    // 21:30 IST daily = 16:00 UTC all week: London moves from 5 PM to 4 PM on the 25th, NY stays at 12 PM.
    const expected = new Map([
      ['2026-10-24', `5:00${NBSP}PM`],
      ['2026-10-25', `4:00${NBSP}PM`],
      ['2026-10-31', `4:00${NBSP}PM`],
      ['2026-11-01', `4:00${NBSP}PM`],
    ]);
    for (const istDate of localDates('2026-10-24', 9)) {
      const window = wallWindowToInstants(istDate, '21:30', '22:30', 'Asia/Kolkata');
      if (window === null) throw new Error('window must exist');

      expect(isoInstant(window.start).slice(11)).toBe('16:00:00Z');
      const london = formatTime(window.start, 'Europe/London');
      const newYork = formatTime(window.start, 'America/New_York');
      const londonExpected = expected.get(istDate);
      if (londonExpected !== undefined) expect(london, istDate).toBe(londonExpected);
      expect(newYork, istDate).toBe(istDate < '2026-11-01' ? `12:00${NBSP}PM` : `11:00${NBSP}AM`);
    }
  });
});

describe('docs/04 §4 cap bucketing', () => {
  it('a Saturday-evening US class counts on Sunday for an IST mentor', () => {
    const start = '2026-10-24T20:00:00Z';

    expect(localDateOf(start, 'America/Los_Angeles')).toBe('2026-10-24');
    expect(localDateOf(start, 'America/New_York')).toBe('2026-10-24');
    expect(localDateOf(start, 'Asia/Kolkata')).toBe('2026-10-25');
  });
});
