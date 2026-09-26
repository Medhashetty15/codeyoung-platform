import { describe, expect, it } from 'vitest';

import {
  addDays,
  daysBetween,
  isLocalDate,
  isoWeekday,
  localDateOf,
  localDates,
  localHour,
  localTimeOf,
  startOfLocalDay,
  todayIn,
} from './calendar.js';
import { isoInstant } from './instant.js';

describe('local dates', () => {
  it('validates YYYY-MM-DD calendar dates', () => {
    expect(isLocalDate('2026-10-24')).toBe(true);
    expect(isLocalDate('2028-02-29')).toBe(true);
    expect(isLocalDate('2026-02-30')).toBe(false);
    expect(isLocalDate('2026-13-01')).toBe(false);
    expect(isLocalDate('2026-1-01')).toBe(false);
    expect(isLocalDate('2026-10-24T00:00:00Z')).toBe(false);
    expect(isLocalDate(20261024)).toBe(false);
  });

  it('gives the date of an instant per zone (Saturday in the US is Sunday in India)', () => {
    const instant = '2026-10-24T20:00:00Z';

    expect(localDateOf(instant, 'America/New_York')).toBe('2026-10-24');
    expect(localDateOf(instant, 'Europe/London')).toBe('2026-10-24');
    expect(localDateOf(instant, 'Asia/Kolkata')).toBe('2026-10-25');
  });

  it('gives local wall-clock hour and time', () => {
    expect(localHour('2026-10-24T20:00:00Z', 'Asia/Kolkata')).toBe(1);
    expect(localTimeOf('2026-10-24T20:00:00Z', 'Asia/Kolkata')).toBe('01:30');
    expect(localTimeOf('2026-10-24T20:00:00Z', 'America/New_York')).toBe('16:00');
  });

  it('knows today in a zone from the server clock', () => {
    const now = '2026-10-24T23:30:00Z';

    expect(todayIn('Europe/London', now)).toBe('2026-10-25');
    expect(todayIn('America/Los_Angeles', now)).toBe('2026-10-24');
  });

  it('adds days across month, year and DST boundaries', () => {
    expect(addDays('2026-10-24', 8)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-10-24', '2026-11-07')).toBe(14);
    expect(daysBetween('2026-11-07', '2026-10-24')).toBe(-14);
  });

  it('lists consecutive dates', () => {
    expect(localDates('2026-10-30', 3)).toEqual(['2026-10-30', '2026-10-31', '2026-11-01']);
    expect(localDates('2026-10-30', 0)).toEqual([]);
  });

  it('uses ISO weekdays (Monday 1, Sunday 7)', () => {
    expect(isoWeekday('2026-10-26')).toBe(1);
    expect(isoWeekday('2026-10-25')).toBe(7);
  });
});

describe('startOfLocalDay', () => {
  it('is local midnight on ordinary days, including DST change days that change at 02:00', () => {
    expect(isoInstant(startOfLocalDay('2026-10-24', 'Europe/London'))).toBe('2026-10-23T23:00:00Z');
    expect(isoInstant(startOfLocalDay('2026-10-25', 'Europe/London'))).toBe('2026-10-24T23:00:00Z');
    expect(isoInstant(startOfLocalDay('2026-10-26', 'Europe/London'))).toBe('2026-10-26T00:00:00Z');
    expect(isoInstant(startOfLocalDay('2026-10-25', 'Asia/Kolkata'))).toBe('2026-10-24T18:30:00Z');
  });

  it('is 01:00 when the zone skips midnight (America/Santiago, 6 Sep 2026)', () => {
    const start = startOfLocalDay('2026-09-06', 'America/Santiago');

    expect(isoInstant(start)).toBe('2026-09-06T04:00:00Z');
    expect(start.toZonedDateTimeISO('America/Santiago').toPlainTime().toString()).toBe('01:00:00');
  });
});
