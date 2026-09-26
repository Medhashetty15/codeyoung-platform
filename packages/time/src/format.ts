import { toInstant } from './instant.js';
import { zoneLabel } from './labels.js';
import { type InstantLike, type LocalDate } from './types.js';

/** Default locale when the caller has none (tests, server rendering). */
export const DEFAULT_LOCALE = 'en-US';

export type DateStyle =
  | 'long' // Saturday 24 October (en-GB) / Saturday, October 24 (en-US)
  | 'longWithYear' // Saturday 24 October 2026
  | 'short' // Sat 24 Oct / Sat, Oct 24
  | 'weekday' // Sat
  | 'dayNumber' // 24
  | 'monthShort'; // Oct

const DATE_STYLES: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  long: { weekday: 'long', day: 'numeric', month: 'long' },
  longWithYear: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  short: { weekday: 'short', day: 'numeric', month: 'short' },
  weekday: { weekday: 'short' },
  dayNumber: { day: 'numeric' },
  monthShort: { month: 'short' },
};

const TWELVE_HOUR: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
// 24-hour clocks always write two hour digits ("09:30", "00:00"), as UK readers expect;
// Intl's 'numeric' hour would give "9:30" and misalign a slot grid.
const TWENTY_FOUR_HOUR: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };

const hourCycles = new Map<string, boolean>();

function timeOptions(locale: string): Intl.DateTimeFormatOptions {
  let twentyFour = hourCycles.get(locale);
  if (twentyFour === undefined) {
    const { hourCycle } = new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions();
    twentyFour = hourCycle === 'h23' || hourCycle === 'h24';
    hourCycles.set(locale, twentyFour);
  }
  return twentyFour ? TWENTY_FOUR_HOUR : TWELVE_HOUR;
}

// Engines disagree on the space before AM/PM (U+202F from ICU, U+0020 from V8's
// format() compatibility patch) and sometimes emit U+2009. Output is always built
// from formatToParts: a no-break space around the day period, and no ICU spaces.
const ICU_SPACES = /[\u202F\u2009]/g;
const NBSP = '\u00A0';

function render(parts: Intl.DateTimeFormatPart[]): string {
  return parts
    .map((part, index) => {
      const touchesDayPeriod =
        parts[index - 1]?.type === 'dayPeriod' || parts[index + 1]?.type === 'dayPeriod';
      if (part.type === 'literal' && touchesDayPeriod && part.value.trim() === '') return NBSP;
      return part.value.replace(ICU_SPACES, NBSP);
    })
    .join('');
}

function formatInstant(format: Intl.DateTimeFormat, at: InstantLike): string {
  return render(format.formatToParts(toInstant(at).epochMilliseconds));
}

// Building an Intl.DateTimeFormat is costly; slot grids format hundreds of times.
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(
  locale: string,
  zone: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale}|${zone}|${JSON.stringify(options)}`;
  let cached = formatters.get(key);
  if (cached === undefined) {
    cached = new Intl.DateTimeFormat(locale, { ...options, timeZone: zone });
    formatters.set(key, cached);
  }
  return cached;
}

/** "5:00 PM" (en-US), "17:00" and "09:30" (en-GB). The locale decides the hour cycle. */
export function formatTime(at: InstantLike, zone: string, locale = DEFAULT_LOCALE): string {
  return formatInstant(formatter(locale, zone, timeOptions(locale)), at);
}

/** Date of the instant in `zone`, in one of the fixed styles. */
export function formatDate(
  at: InstantLike,
  zone: string,
  style: DateStyle,
  locale = DEFAULT_LOCALE,
): string {
  return formatInstant(formatter(locale, zone, DATE_STYLES[style]), at);
}

/** Formats a zone-less calendar date (a day tab, a DST notice date). */
export function formatLocalDate(
  date: LocalDate,
  style: DateStyle,
  locale = DEFAULT_LOCALE,
): string {
  // Noon UTC of that date is the same calendar date when formatted in UTC.
  return formatDate(`${date}T12:00:00Z`, 'UTC', style, locale);
}

/** "Sat, Oct 24, 5:00 PM" (en-US), "Sat 24 Oct, 17:00" (en-GB). */
export function formatDateTime(at: InstantLike, zone: string, locale = DEFAULT_LOCALE): string {
  return `${formatDate(at, zone, 'short', locale)}, ${formatTime(at, zone, locale)}`;
}

/**
 * Time range without dashes (docs/07 copy rules; never Intl formatRange):
 * "5:00 to 6:00 PM", "11:30 AM to 12:30 PM", "17:00 to 18:00", "00:00 to 01:00". The day period
 * is written once when both ends share it.
 */
export function formatTimeRange(
  start: InstantLike,
  end: InstantLike,
  zone: string,
  locale = DEFAULT_LOCALE,
): string {
  const format = formatter(locale, zone, timeOptions(locale));
  const startParts = format.formatToParts(toInstant(start).epochMilliseconds);
  const endParts = format.formatToParts(toInstant(end).epochMilliseconds);
  const period = (parts: Intl.DateTimeFormatPart[]) =>
    parts.find((part) => part.type === 'dayPeriod')?.value;
  const startPeriod = period(startParts);
  const sharesPeriod = startPeriod !== undefined && startPeriod === period(endParts);
  const startText = sharesPeriod ? withoutDayPeriod(startParts) : render(startParts);
  return `${startText} to ${render(endParts)}`;
}

function withoutDayPeriod(parts: Intl.DateTimeFormatPart[]): string {
  return render(parts.filter((part) => part.type !== 'dayPeriod')).trim();
}

export interface HumanTime {
  /** "Saturday, 24 October 2026" */
  date: string;
  /** "5:00 to 6:00 PM" */
  time: string;
  /** "London time (GMT+1)" */
  zone: string;
  /** "Saturday, 24 October 2026, 5:00 to 6:00 PM London time (GMT+1)" */
  text: string;
}

/**
 * Class time as written in emails (docs/03 §7.3, PD-06): same zone wording as
 * the UI, 12-hour clock, no abbreviations, no dashes. Fixed English output so
 * the text does not depend on the server's locale data.
 */
export function formatForHumans(start: InstantLike, end: InstantLike, zone: string): HumanTime {
  const parts = formatter('en-GB', zone, DATE_STYLES.longWithYear).formatToParts(
    toInstant(start).epochMilliseconds,
  );
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';
  const date = `${part('weekday')}, ${part('day')} ${part('month')} ${part('year')}`;
  const time = formatTimeRange(start, end, zone, 'en-US');
  const label = zoneLabel(zone, start);
  return { date, time, zone: label, text: `${date}, ${time} ${label}` };
}
