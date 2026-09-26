import { Temporal } from 'temporal-polyfill';

import { toInstant } from './instant.js';
import { type InstantLike, type LocalDate } from './types.js';

const LOCAL_DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar date written as `YYYY-MM-DD` (rejects `2026-02-30`). */
export function isLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== 'string' || !LOCAL_DATE_SHAPE.test(value)) return false;
  try {
    Temporal.PlainDate.from(value, { overflow: 'reject' });
    return true;
  } catch {
    return false;
  }
}

function plainDate(date: LocalDate): Temporal.PlainDate {
  return Temporal.PlainDate.from(date, { overflow: 'reject' });
}

/** Calendar date of the instant as seen in `zone`. */
export function localDateOf(at: InstantLike, zone: string): LocalDate {
  return toInstant(at).toZonedDateTimeISO(zone).toPlainDate().toString();
}

/** Wall-clock hour (0 to 23) of the instant in `zone`. */
export function localHour(at: InstantLike, zone: string): number {
  return toInstant(at).toZonedDateTimeISO(zone).hour;
}

/** Wall-clock time `HH:MM` of the instant in `zone`. */
export function localTimeOf(at: InstantLike, zone: string): string {
  return toInstant(at).toZonedDateTimeISO(zone).toPlainTime().toString({ smallestUnit: 'minute' });
}

/** Today's date in `zone`, given the current instant (pass the server or skew-corrected time). */
export function todayIn(zone: string, now: InstantLike): LocalDate {
  return localDateOf(now, zone);
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return plainDate(date).add({ days }).toString();
}

/** Days from `a` to `b` (negative when `b` is earlier). */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  return plainDate(a).until(plainDate(b), { largestUnit: 'day' }).days;
}

/** `count` consecutive dates starting at `from`. */
export function localDates(from: LocalDate, count: number): LocalDate[] {
  return Array.from({ length: count }, (_, index) => addDays(from, index));
}

/** ISO weekday: 1 = Monday ... 7 = Sunday. */
export function isoWeekday(date: LocalDate): number {
  return plainDate(date).dayOfWeek;
}

/**
 * First instant of the date in `zone`. Usually local midnight, but later when
 * the zone skips midnight for DST (e.g. America/Santiago in September).
 */
export function startOfLocalDay(date: LocalDate, zone: string): Temporal.Instant {
  return plainDate(date).toZonedDateTime({ timeZone: zone }).toInstant();
}
