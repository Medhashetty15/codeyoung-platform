import {
  addDays,
  instantFromEpochMs,
  isoWeekday,
  localDateOf,
  type LocalDate,
  type Temporal,
  wallWindowToInstants,
} from '@app/time';

import { type Interval, mergeIntervals, subtractIntervals } from './intervals';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

export interface SlotEngineConfig {
  durationMinutes: number;
  gridMinutes: number;
  bufferMinutes: number;
  leadMinutes: number;
  horizonDays: number;
}

/** Weekly wall-clock window in the mentor's zone; an end at or before the start crosses midnight. */
export interface AvailabilityRule {
  weekday: number;
  startLocal: string;
  endLocal: string;
  effectiveFrom: LocalDate;
  effectiveTo: LocalDate | null;
}

export interface ExistingBooking {
  startsAt: Temporal.Instant;
  /** End plus buffer: the range the exclusion constraint protects. */
  blockedUntil: Temporal.Instant;
  /** Cap bucket (A-1). */
  mentorLocalDate: LocalDate;
}

export interface TimeOff {
  startsAt: Temporal.Instant;
  endsAt: Temporal.Instant;
}

export interface MentorSchedule {
  id: string;
  timezone: string;
  maxTrialsPerDay: number;
  rules: readonly AvailabilityRule[];
  timeOff: readonly TimeOff[];
  /** Confirmed bookings only. */
  bookings: readonly ExistingBooking[];
}

export interface SlotRange {
  /** Candidate starts in `[from, to)`. */
  from: Temporal.Instant;
  to: Temporal.Instant;
  /** Server time; lead time and horizon count from here. */
  now: Temporal.Instant;
}

export interface FreeSlot {
  start: Temporal.Instant;
  /** Mentors who can take it, in input order. */
  mentorIds: string[];
}

export interface SlotComputation {
  /** Bookable slots, earliest first. */
  free: FreeSlot[];
  /**
   * Starts where some mentor is scheduled to work (lead time and horizon
   * applied) whether or not it is already taken: tells "fully booked" from
   * "no classes" (docs/03 §4, contracts DayStatus).
   */
  scheduled: Temporal.Instant[];
}

/**
 * The slot engine (docs/03 §4). Pure: everything it needs is in the arguments.
 *
 * A mentor can take `[t, t + duration)` when `[t, t + duration + buffer)` lies
 * inside their availability, outside their time off, does not meet any of
 * their confirmed `[starts_at, blocked_until)` ranges (the exact rule of the
 * `bookings_no_mentor_overlap` exclusion constraint), and they have fewer than
 * their cap of classes on the mentor-local date of `t`. Starts sit on the UTC
 * grid, at least the lead time after `now` and before the horizon.
 */
export function computeSlots(
  range: SlotRange,
  config: SlotEngineConfig,
  mentors: readonly MentorSchedule[],
): SlotComputation {
  const grid = config.gridMinutes * MINUTE;
  const footprint = (config.durationMinutes + config.bufferMinutes) * MINUTE;
  const earliest = Math.max(
    range.from.epochMilliseconds,
    range.now.epochMilliseconds + config.leadMinutes * MINUTE,
  );
  const latest = Math.min(
    range.to.epochMilliseconds,
    range.now.epochMilliseconds + config.horizonDays * DAY,
  );

  const free = new Map<number, string[]>();
  const scheduled = new Set<number>();
  for (const mentor of mentors) {
    const working = subtractIntervals(
      availabilityIntervals(mentor, range),
      mentor.timeOff.map((off) => ({
        start: off.startsAt.epochMilliseconds,
        end: off.endsAt.epochMilliseconds,
      })),
    );
    const open = subtractIntervals(
      working,
      mentor.bookings.map((booking) => ({
        start: booking.startsAt.epochMilliseconds,
        end: booking.blockedUntil.epochMilliseconds,
      })),
    );
    const classesPerDay = countByDate(mentor.bookings);

    for (const start of gridStarts(working, earliest, latest, grid, footprint))
      scheduled.add(start);
    for (const start of gridStarts(open, earliest, latest, grid, footprint)) {
      const day = localDateOf(instantFromEpochMs(start), mentor.timezone);
      if ((classesPerDay.get(day) ?? 0) >= mentor.maxTrialsPerDay) continue;
      const takers = free.get(start);
      if (takers === undefined) free.set(start, [mentor.id]);
      else takers.push(mentor.id);
    }
  }

  return {
    free: [...free.entries()]
      .sort(([a], [b]) => a - b)
      .map(([start, mentorIds]) => ({ start: instantFromEpochMs(start), mentorIds })),
    scheduled: [...scheduled].sort((a, b) => a - b).map((start) => instantFromEpochMs(start)),
  };
}

/** Rule windows as instants for every mentor-local date the range can touch. */
function availabilityIntervals(mentor: MentorSchedule, range: SlotRange): Interval[] {
  // A window that starts the day before can run past midnight into the range.
  const firstDate = addDays(localDateOf(range.from, mentor.timezone), -1);
  const lastDate = localDateOf(range.to, mentor.timezone);
  const windows: Interval[] = [];
  for (let date = firstDate; date <= lastDate; date = addDays(date, 1)) {
    const weekday = isoWeekday(date);
    for (const rule of mentor.rules) {
      if (rule.weekday !== weekday || date < rule.effectiveFrom) continue;
      if (rule.effectiveTo !== null && date > rule.effectiveTo) continue;
      const window = wallWindowToInstants(date, rule.startLocal, rule.endLocal, mentor.timezone);
      if (window !== null) {
        windows.push({ start: window.start.epochMilliseconds, end: window.end.epochMilliseconds });
      }
    }
  }
  return mergeIntervals(windows);
}

/** Grid-aligned starts `t` in `[earliest, latest)` with `[t, t + footprint)` inside one interval. */
function gridStarts(
  intervals: readonly Interval[],
  earliest: number,
  latest: number,
  grid: number,
  footprint: number,
): number[] {
  const starts: number[] = [];
  for (const interval of intervals) {
    const first = Math.ceil(Math.max(interval.start, earliest) / grid) * grid;
    for (let start = first; start < latest && start + footprint <= interval.end; start += grid) {
      starts.push(start);
    }
  }
  return starts;
}

function countByDate(bookings: readonly ExistingBooking[]): Map<LocalDate, number> {
  const counts = new Map<LocalDate, number>();
  for (const booking of bookings) {
    counts.set(booking.mentorLocalDate, (counts.get(booking.mentorLocalDate) ?? 0) + 1);
  }
  return counts;
}
