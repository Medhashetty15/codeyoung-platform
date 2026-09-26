import { describe, expect, it } from 'vitest';

import {
  type DateStyle,
  formatDate,
  formatDateTime,
  formatForHumans,
  formatLocalDate,
  formatTime,
  formatTimeRange,
} from './format.js';

const NBSP = '\u00A0';
const DASHES = /[\u2012\u2013\u2014\u2015\u2212]/;
const ICU_SPACES = /[\u202F\u2009]/;
const LONDON_5PM = '2026-10-24T16:00:00Z';
const LONDON_6PM = '2026-10-24T17:00:00Z';

describe('formatTime', () => {
  it('lets the locale decide the hour cycle', () => {
    expect(formatTime(LONDON_5PM, 'Europe/London', 'en-US')).toBe(`5:00${NBSP}PM`);
    expect(formatTime(LONDON_5PM, 'Europe/London', 'en-GB')).toBe('17:00');
  });

  it('renders the same instant in each viewer zone', () => {
    const instant = '2026-10-24T20:00:00Z';

    expect(formatTime(instant, 'America/New_York')).toBe(`4:00${NBSP}PM`);
    expect(formatTime(instant, 'Asia/Kolkata')).toBe(`1:30${NBSP}AM`);
  });

  it('defaults to en-US', () => {
    expect(formatTime(LONDON_5PM, 'Europe/London')).toBe(`5:00${NBSP}PM`);
  });
});

describe('formatTimeRange', () => {
  it('writes a shared day period once', () => {
    expect(formatTimeRange(LONDON_5PM, LONDON_6PM, 'Europe/London', 'en-US')).toBe(
      `5:00 to 6:00${NBSP}PM`,
    );
  });

  it('keeps both day periods when they differ', () => {
    expect(
      formatTimeRange('2026-10-24T10:30:00Z', '2026-10-24T11:30:00Z', 'Europe/London', 'en-US'),
    ).toBe(`11:30${NBSP}AM to 12:30${NBSP}PM`);
    expect(
      formatTimeRange('2026-10-24T22:30:00Z', '2026-10-24T23:30:00Z', 'Europe/London', 'en-US'),
    ).toBe(`11:30${NBSP}PM to 12:30${NBSP}AM`);
  });

  it('uses the 24-hour clock where the locale does', () => {
    expect(formatTimeRange(LONDON_5PM, LONDON_6PM, 'Europe/London', 'en-GB')).toBe(
      '17:00 to 18:00',
    );
  });

  it('keeps en-GB lowercase day periods when 12-hour is forced by the locale', () => {
    // en-AU uses a 12-hour clock with lowercase periods; casing comes from CLDR.
    expect(formatTimeRange(LONDON_5PM, LONDON_6PM, 'Europe/London', 'en-AU')).toBe(
      `5:00 to 6:00${NBSP}pm`,
    );
  });
});

describe('formatDate', () => {
  const cases: [DateStyle, string, string][] = [
    ['long', 'Saturday 24 October', 'Saturday, October 24'],
    ['longWithYear', 'Saturday, 24 October 2026', 'Saturday, October 24, 2026'],
    ['short', 'Sat 24 Oct', 'Sat, Oct 24'],
    ['weekday', 'Sat', 'Sat'],
    ['dayNumber', '24', '24'],
    ['monthShort', 'Oct', 'Oct'],
  ];

  it.each(cases)('%s style', (style, enGB, enUS) => {
    expect(formatDate(LONDON_5PM, 'Europe/London', style, 'en-GB')).toBe(enGB);
    expect(formatDate(LONDON_5PM, 'Europe/London', style, 'en-US')).toBe(enUS);
  });

  it('uses the date in the given zone', () => {
    expect(formatDate('2026-10-24T20:00:00Z', 'Asia/Kolkata', 'short', 'en-GB')).toBe('Sun 25 Oct');
  });

  it('formats zone-less dates as the same calendar day', () => {
    expect(formatLocalDate('2026-10-25', 'short', 'en-GB')).toBe('Sun 25 Oct');
    expect(formatLocalDate('2026-10-25', 'long', 'en-US')).toBe('Sunday, October 25');
  });

  it('combines date and time', () => {
    expect(formatDateTime(LONDON_5PM, 'Europe/London', 'en-GB')).toBe('Sat 24 Oct, 17:00');
    expect(formatDateTime(LONDON_5PM, 'Europe/London', 'en-US')).toBe(`Sat, Oct 24, 5:00${NBSP}PM`);
  });
});

describe('formatForHumans (emails)', () => {
  it('matches the parent wording from PD-06', () => {
    expect(formatForHumans(LONDON_5PM, LONDON_6PM, 'Europe/London')).toEqual({
      date: 'Saturday, 24 October 2026',
      time: `5:00 to 6:00${NBSP}PM`,
      zone: 'London time (GMT+1)',
      text: `Saturday, 24 October 2026, 5:00 to 6:00${NBSP}PM London time (GMT+1)`,
    });
  });

  it('renders the same class for the mentor in IST', () => {
    expect(formatForHumans(LONDON_5PM, LONDON_6PM, 'Asia/Kolkata').text).toBe(
      `Saturday, 24 October 2026, 9:30 to 10:30${NBSP}PM Kolkata time (GMT+5:30)`,
    );
  });

  it('uses the recipient date, not the UTC date', () => {
    expect(
      formatForHumans('2026-10-24T20:00:00Z', '2026-10-24T21:00:00Z', 'Asia/Kolkata').date,
    ).toBe('Sunday, 25 October 2026');
  });
});

describe('copy rules', () => {
  const zones = ['Europe/London', 'America/New_York', 'Asia/Kolkata', 'America/Los_Angeles', 'UTC'];
  const locales = ['en-US', 'en-GB', 'en-AU', 'en-IN', 'en-CA'];
  const instants: [string, string][] = [
    [LONDON_5PM, LONDON_6PM],
    ['2026-10-24T10:30:00Z', '2026-10-24T11:30:00Z'],
    ['2026-10-25T00:30:00Z', '2026-10-25T01:30:00Z'],
  ];

  it('never emits en/em dashes or ICU narrow spaces in any formatter', () => {
    for (const zone of zones) {
      for (const locale of locales) {
        for (const [start, end] of instants) {
          const outputs = [
            formatTime(start, zone, locale),
            formatTimeRange(start, end, zone, locale),
            formatDateTime(start, zone, locale),
            formatForHumans(start, end, zone).text,
            ...(
              ['long', 'longWithYear', 'short', 'weekday', 'dayNumber', 'monthShort'] as const
            ).map((style) => formatDate(start, zone, style, locale)),
          ];
          for (const output of outputs) {
            expect(output, `${zone} ${locale}`).not.toMatch(DASHES);
            expect(output, `${zone} ${locale}`).not.toMatch(ICU_SPACES);
          }
        }
      }
    }
  });
});
