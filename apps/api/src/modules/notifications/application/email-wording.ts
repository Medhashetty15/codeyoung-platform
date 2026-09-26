import {
  daysBetween,
  formatDate,
  formatForHumans,
  formatTime,
  formatTimeRange,
  type InstantLike,
  localDateOf,
  todayIn,
  zoneLabel,
} from '@app/time';

/** Email wording shared with the UI (PD-06, docs/04 §5): no bare abbreviations, no dashes. */

/** "Saturday, 24 October 2026, 5:00 to 6:00 PM London time (GMT+1)" */
export function classWhen(start: InstantLike, end: InstantLike, zone: string): string {
  return formatForHumans(start, end, zone).text;
}

/** "5:00 to 6:00 PM London time (GMT+1)": the class for the other participant. */
export function classTime(start: InstantLike, end: InstantLike, zone: string): string {
  return `${formatTimeRange(start, end, zone, 'en-US')} ${zoneLabel(zone, start)}`;
}

/** "Saturday 24 October" for subjects. */
export function shortDate(start: InstantLike, zone: string): string {
  return formatDate(start, zone, 'long', 'en-GB');
}

/** "5:00 PM London time (GMT+1)" */
export function startTime(start: InstantLike, zone: string): string {
  return `${formatTime(start, zone, 'en-US')} ${zoneLabel(zone, start)}`;
}

/**
 * "today", "tomorrow" or "on Saturday", by calendar days in the recipient's
 * zone (docs/04 §4). Counting days, not 24-hour periods, keeps it right across
 * DST changes and when a reminder goes out late.
 */
export function relativeDay(start: InstantLike, zone: string, now: InstantLike): string {
  const days = daysBetween(todayIn(zone, now), localDateOf(start, zone));
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `on ${formatDate(start, zone, 'long', 'en-GB')}`;
}

/** 10 -> "10 minutes", 60 -> "1 hour", 120 -> "2 hours", 90 -> "90 minutes". */
export function durationWords(minutes: number): string {
  if (minutes >= 60 && minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }
  return minutes === 1 ? '1 minute' : `${minutes} minutes`;
}
