import { Temporal } from 'temporal-polyfill';

import { type InstantLike } from './types.js';

/** Parses an ISO 8601 string that carries `Z` or an offset; passes instants through. */
export function toInstant(value: InstantLike): Temporal.Instant {
  return typeof value === 'string' ? Temporal.Instant.from(value) : value;
}

/** Canonical API representation: UTC, second precision, e.g. `2026-10-24T16:00:00Z`. */
export function isoInstant(value: InstantLike): string {
  return toInstant(value).toString({ smallestUnit: 'second' });
}

export function nowInstant(): Temporal.Instant {
  return Temporal.Now.instant();
}

export function epochMs(value: InstantLike): number {
  return toInstant(value).epochMilliseconds;
}

export function instantFromEpochMs(ms: number): Temporal.Instant {
  return Temporal.Instant.fromEpochMilliseconds(ms);
}

/** Converts to a JavaScript Date for library edges (ORM, mailers); never for calendar math. */
export function toDate(value: InstantLike): Date {
  return new Date(epochMs(value));
}

export function fromDate(date: Date): Temporal.Instant {
  return Temporal.Instant.fromEpochMilliseconds(date.getTime());
}

export function addMinutes(value: InstantLike, minutes: number): Temporal.Instant {
  return toInstant(value).add({ minutes });
}

export function compareInstants(a: InstantLike, b: InstantLike): number {
  return Temporal.Instant.compare(toInstant(a), toInstant(b));
}

export function isBefore(a: InstantLike, b: InstantLike): boolean {
  return compareInstants(a, b) < 0;
}

export function isAfter(a: InstantLike, b: InstantLike): boolean {
  return compareInstants(a, b) > 0;
}

/** Whole minutes from `a` to `b` (negative when `b` is earlier), truncated toward zero. */
export function minutesBetween(a: InstantLike, b: InstantLike): number {
  return Math.trunc((epochMs(b) - epochMs(a)) / 60_000);
}

export interface DurationParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * Remaining time split for a countdown. Exact elapsed time (not calendar days),
 * rounded down to whole seconds; zero once `to` is not after `from`.
 */
export function durationParts(from: InstantLike, to: InstantLike): DurationParts {
  const totalSeconds = Math.max(0, Math.floor((epochMs(to) - epochMs(from)) / 1000));
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}
