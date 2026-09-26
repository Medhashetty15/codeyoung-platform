import { Injectable } from '@nestjs/common';
import { type EntityManager } from 'typeorm';

import { ErrorCode, type Slot, type SlotsQuery, type SlotsResponse } from '@app/contracts';
import {
  addDays,
  addMinutes,
  daysBetween,
  dstTransitionsBetween,
  isoInstant,
  localDateOf,
  localDates,
  startOfLocalDay,
  type Temporal,
  todayIn,
} from '@app/time';

import { Clock } from '../../../common/clock/clock';
import { AppError } from '../../../common/errors/app-error';
import { AppConfig } from '../../../config/app-config';
import { ConfirmedBookingsQuery } from '../../bookings/infra/confirmed-bookings.query';
import { MentorScheduleQuery } from '../../mentors/infra/mentor-schedule.query';
import { groupByLocalDate } from '../domain/day-grouping';
import {
  computeSlots,
  type MentorSchedule,
  type SlotComputation,
  type SlotEngineConfig,
} from '../domain/slot-engine';

/** Bookings this far around a range are loaded so every cap bucket is complete. */
const CAP_PADDING_HOURS = 48;

/**
 * Public availability (docs/03 §4): loads schedules and bookings, runs the pure
 * slot engine, groups slots by the requester's local date. Mentor identities
 * never leave the server.
 */
@Injectable()
export class AvailabilityService {
  constructor(
    private readonly schedules: MentorScheduleQuery,
    private readonly bookings: ConfirmedBookingsQuery,
    private readonly config: AppConfig,
    private readonly clock: Clock,
  ) {}

  get engineConfig(): SlotEngineConfig {
    const booking = this.config.booking;
    return {
      durationMinutes: booking.trialDurationMinutes,
      gridMinutes: booking.slotGridMinutes,
      bufferMinutes: booking.mentorBufferMinutes,
      leadMinutes: booking.leadTimeMinutes,
      horizonDays: booking.horizonDays,
    };
  }

  async slots(query: SlotsQuery): Promise<SlotsResponse> {
    const now = this.clock.now();
    const timezone = query.tz;
    const today = todayIn(timezone, now);
    const from = query.from ?? today;
    const horizonDays = this.config.booking.horizonDays;
    // The window may start yesterday (a client behind midnight) and at most at the horizon.
    const offset = daysBetween(today, from);
    if (offset < -1 || offset > horizonDays) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, {
        detail: `from must be between yesterday and ${horizonDays} days ahead in ${timezone}.`,
        extras: { errors: [{ path: 'from', message: 'Outside the booking horizon' }] },
      });
    }

    const dates = localDates(from, query.days);
    const windowStart = startOfLocalDay(from, timezone);
    const windowEnd = startOfLocalDay(addDays(from, query.days), timezone);
    const horizonEnd = now.add({ hours: 24 * horizonDays });
    // One computation covers the window and the whole horizon (for nextAvailable).
    const computation = await this.compute(
      earliestOf(windowStart, now),
      latestOf(windowEnd, horizonEnd),
      now,
    );
    const inWindow = (start: Temporal.Instant) =>
      start.epochMilliseconds >= windowStart.epochMilliseconds &&
      start.epochMilliseconds < windowEnd.epochMilliseconds;

    const durationMinutes = this.config.booking.trialDurationMinutes;
    const first = computation.free[0];
    return {
      timezone,
      slotDurationMinutes: durationMinutes,
      generatedAt: isoInstant(now),
      days: groupByLocalDate({
        dates,
        timezone,
        durationMinutes,
        free: computation.free.map((slot) => slot.start).filter(inWindow),
        scheduled: computation.scheduled.filter(inWindow),
        transitions: dstTransitionsBetween(windowStart, windowEnd, timezone),
      }),
      nextAvailable: first === undefined ? null : this.toSlot(first.start),
    };
  }

  /**
   * Mentors the engine considers free for a slot starting at `start`, in
   * engine order. `excludeBookingId` ignores a booking being rescheduled.
   */
  async candidates(start: Temporal.Instant, excludeBookingId?: string): Promise<string[]> {
    const computation = await this.compute(
      start,
      start.add({ milliseconds: 1 }),
      this.clock.now(),
      {
        excludeBookingId,
      },
    );
    return computation.free[0]?.mentorIds ?? [];
  }

  /**
   * Re-checks one mentor inside the booking transaction, after the mentor row
   * is locked, with data read through that transaction (docs/03 §5.1).
   */
  async isFreeUnderLock(
    manager: EntityManager,
    mentorId: string,
    start: Temporal.Instant,
    excludeBookingId?: string,
  ): Promise<boolean> {
    const computation = await this.compute(
      start,
      start.add({ milliseconds: 1 }),
      this.clock.now(),
      {
        manager,
        mentorIds: [mentorId],
        excludeBookingId,
      },
    );
    return computation.free[0]?.mentorIds.includes(mentorId) ?? false;
  }

  /** Bookable slots closest to `around` (either side), earliest first: conflict alternatives. */
  async nearest(
    around: Temporal.Instant,
    count: number,
    excludeBookingId?: string,
  ): Promise<Slot[]> {
    const now = this.clock.now();
    const horizonEnd = now.add({ hours: 24 * this.config.booking.horizonDays });
    const computation = await this.compute(now, horizonEnd, now, { excludeBookingId });
    const distance = (start: Temporal.Instant) =>
      Math.abs(start.epochMilliseconds - around.epochMilliseconds);
    return computation.free
      .map((slot) => slot.start)
      .filter((start) => !start.equals(around))
      .sort((a, b) => distance(a) - distance(b) || a.epochMilliseconds - b.epochMilliseconds)
      .slice(0, count)
      .sort((a, b) => a.epochMilliseconds - b.epochMilliseconds)
      .map((start) => this.toSlot(start));
  }

  private async compute(
    from: Temporal.Instant,
    to: Temporal.Instant,
    now: Temporal.Instant,
    options: {
      manager?: EntityManager;
      mentorIds?: readonly string[];
      excludeBookingId?: string;
    } = {},
  ): Promise<SlotComputation> {
    const padding = { hours: CAP_PADDING_HOURS };
    const schedules = options.manager
      ? this.schedules.withManager(options.manager)
      : this.schedules;
    const bookings = options.manager ? this.bookings.withManager(options.manager) : this.bookings;
    const mentorSchedules = await schedules.activeSchedules(
      {
        from: from.subtract(padding),
        to: to.add(padding),
        firstDate: addDays(localDateOf(from, 'UTC'), -2),
        lastDate: addDays(localDateOf(to, 'UTC'), 2),
      },
      options.mentorIds,
    );
    const confirmed = await bookings.forMentors(
      mentorSchedules.map((schedule) => schedule.id),
      from.subtract(padding),
      to.add(padding),
      options.excludeBookingId,
    );
    const mentors: MentorSchedule[] = mentorSchedules.map((schedule) => ({
      ...schedule,
      bookings: confirmed.filter((booking) => booking.mentorId === schedule.id),
    }));
    return computeSlots({ from, to, now }, this.engineConfig, mentors);
  }

  private toSlot(start: Temporal.Instant): Slot {
    return {
      start: isoInstant(start),
      end: isoInstant(addMinutes(start, this.config.booking.trialDurationMinutes)),
    };
  }
}

function earliestOf(a: Temporal.Instant, b: Temporal.Instant): Temporal.Instant {
  return a.epochMilliseconds <= b.epochMilliseconds ? a : b;
}

function latestOf(a: Temporal.Instant, b: Temporal.Instant): Temporal.Instant {
  return a.epochMilliseconds >= b.epochMilliseconds ? a : b;
}
