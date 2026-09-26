import { type DayStatus, type SlotDay } from '@app/contracts';
import {
  addMinutes,
  isoInstant,
  localDateOf,
  type LocalDate,
  type Temporal,
  toInstant,
  type ZoneTransition,
} from '@app/time';

export interface DayGroupingInput {
  /** Every date of the requested window, in the requester's zone. */
  dates: readonly LocalDate[];
  timezone: string;
  durationMinutes: number;
  /** Bookable starts, earliest first. */
  free: readonly Temporal.Instant[];
  /** Starts where some mentor works (taken or not). */
  scheduled: readonly Temporal.Instant[];
  transitions: readonly ZoneTransition[];
}

/**
 * Groups engine output by the requester's local date (docs/04 §4): a slot at
 * 20:00Z is Saturday in New York and Sunday in India. Every requested date is
 * present, empty or not.
 */
export function groupByLocalDate(input: DayGroupingInput): SlotDay[] {
  const bucket = <T>(items: readonly T[], instantOf: (item: T) => Temporal.Instant) => {
    const byDate = new Map<LocalDate, T[]>();
    for (const item of items) {
      const date = localDateOf(instantOf(item), input.timezone);
      const list = byDate.get(date);
      if (list === undefined) byDate.set(date, [item]);
      else list.push(item);
    }
    return byDate;
  };
  const freeByDate = bucket(input.free, (start) => start);
  const scheduledByDate = bucket(input.scheduled, (start) => start);
  const transitionByDate = bucket(input.transitions, (transition) => toInstant(transition.at));

  return input.dates.map((date) => {
    const slots = (freeByDate.get(date) ?? []).map((start) => ({
      start: isoInstant(start),
      end: isoInstant(addMinutes(start, input.durationMinutes)),
    }));
    const status: DayStatus =
      slots.length > 0
        ? 'AVAILABLE'
        : (scheduledByDate.get(date)?.length ?? 0) > 0
          ? 'FULLY_BOOKED'
          : 'NO_AVAILABILITY';
    const transition = transitionByDate.get(date)?.[0];
    return {
      date,
      status,
      slots,
      ...(transition === undefined ? {} : { dstTransition: transition }),
    };
  });
}
