import { Temporal } from 'temporal-polyfill';

import { addDays } from './calendar.js';
import { type LocalDate } from './types.js';

/** Which side of a wall-clock window a time is; decides gap/overlap handling. */
export type WindowEdge = 'start' | 'end';

export interface InstantWindow {
  start: Temporal.Instant;
  end: Temporal.Instant;
}

/** Parses `HH:MM` or `HH:MM:SS` (24-hour clock). */
export function parseWallTime(value: string): Temporal.PlainTime {
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(value)) throw new RangeError(`Invalid wall time: ${value}`);
  return Temporal.PlainTime.from(value, { overflow: 'reject' });
}

/**
 * Converts a wall-clock time on a date in `zone` to an instant, applying the
 * DST policy of docs/04 §3:
 * - gap (time does not exist): both edges resolve to the transition instant,
 *   i.e. a start moves forward to the first valid time and an end is clipped
 *   to where the gap begins;
 * - overlap (time happens twice): a start takes the earlier occurrence, an
 *   end the later one, so the window covers the full wall-clock span.
 */
export function wallTimeToInstant(
  date: LocalDate,
  time: string | Temporal.PlainTime,
  zone: string,
  edge: WindowEdge,
): Temporal.Instant {
  const wallTime = typeof time === 'string' ? parseWallTime(time) : time;
  const local = Temporal.PlainDate.from(date, { overflow: 'reject' }).toPlainDateTime(wallTime);
  try {
    return local.toZonedDateTime(zone, { disambiguation: 'reject' }).toInstant();
  } catch {
    const earlier = local.toZonedDateTime(zone, { disambiguation: 'earlier' });
    const isOverlap = Temporal.PlainDateTime.compare(earlier.toPlainDateTime(), local) === 0;
    if (isOverlap) {
      return edge === 'start'
        ? earlier.toInstant()
        : local.toZonedDateTime(zone, { disambiguation: 'later' }).toInstant();
    }
    const transition = earlier.getTimeZoneTransition('next');
    if (transition === null) throw new RangeError('Gap without a following transition');
    return transition.toInstant();
  }
}

/**
 * Turns a recurring wall-clock window (e.g. 19:00 to 23:00 in Asia/Kolkata)
 * into real instants for one date. An end at or before the start means the
 * window crosses midnight into the next day. Returns null when nothing of the
 * window exists on that date (entirely inside a DST gap).
 */
export function wallWindowToInstants(
  date: LocalDate,
  start: string,
  end: string,
  zone: string,
): InstantWindow | null {
  const startTime = parseWallTime(start);
  const endTime = parseWallTime(end);
  const endDate = Temporal.PlainTime.compare(endTime, startTime) <= 0 ? addDays(date, 1) : date;
  const window = {
    start: wallTimeToInstant(date, startTime, zone, 'start'),
    end: wallTimeToInstant(endDate, endTime, zone, 'end'),
  };
  return Temporal.Instant.compare(window.end, window.start) > 0 ? window : null;
}
