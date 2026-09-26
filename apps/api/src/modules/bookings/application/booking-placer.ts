import { Injectable } from '@nestjs/common';
import { type EntityManager } from 'typeorm';

import { addMinutes, localDateOf, type Temporal } from '@app/time';

import { Clock } from '../../../common/clock/clock';
import { AppConfig } from '../../../config/app-config';
import { isExclusionViolation, isUniqueViolation } from '../../../database/pg-errors';
import {
  AvailabilityService,
  type BookingWindow,
} from '../../availability/application/availability.service';
import { MeetingProvider } from '../../classroom/domain/meeting-provider';
import { type LockedMentor, MentorsRepository } from '../../mentors/infra/mentors.repository';
import { newBookingReference } from '../domain/booking-reference';
import { type BookingRecord, BookingsRepository } from '../infra/bookings.repository';

const SAVEPOINT = 'booking_candidate';
const REFERENCE_ATTEMPTS = 3;

export interface Placement {
  slotStart: Temporal.Instant;
  /** Candidate mentors, best first (AssignmentStrategy). */
  rankedMentorIds: readonly string[];
  parentId: string;
  studentId: string;
  parentTimezone: string;
  rescheduledFromId: string | null;
  idempotencyKey: string | null;
  requestFingerprint: string | null;
  /** A booking being moved: ignored when re-checking the new slot. */
  excludeBookingId?: string;
}

/**
 * The capacity-safe insert of docs/03 §5.1. For each candidate, inside a
 * savepoint: lock the mentor row (serialises every capacity change for that
 * mentor, so the daily cap holds), re-check availability with fresh data,
 * then insert; the exclusion constraint is the final word on overlaps. A
 * failed candidate rolls back to the savepoint, which also releases its lock,
 * so at most one mentor lock is held at a time (no mentor-lock deadlocks).
 */
@Injectable()
export class BookingPlacer {
  constructor(
    private readonly mentors: MentorsRepository,
    private readonly bookings: BookingsRepository,
    private readonly availability: AvailabilityService,
    private readonly meetings: MeetingProvider,
    private readonly config: AppConfig,
    private readonly clock: Clock,
  ) {}

  /** The new booking, or null when no candidate could take the slot. */
  async place(manager: EntityManager, placement: Placement): Promise<BookingRecord | null> {
    return this.firstThatTakes(
      manager,
      placement.rankedMentorIds,
      {
        start: placement.slotStart,
        excludeBookingId: placement.excludeBookingId,
        window: 'parent',
      },
      (mentor) => this.insertFor(manager, placement, mentor),
    );
  }

  /**
   * Ops reassign (docs/03 §5.3): the same booking row moves to the first
   * candidate that is still free under its lock, with a new mentor link and
   * the next calendar sequence. Lead time and horizon do not apply.
   */
  async reassign(
    manager: EntityManager,
    booking: BookingRecord,
    rankedMentorIds: readonly string[],
  ): Promise<BookingRecord | null> {
    return this.firstThatTakes(
      manager,
      rankedMentorIds.filter((id) => id !== booking.mentorId),
      { start: booking.startsAt, excludeBookingId: booking.id, window: 'ops' },
      async (mentor) => {
        try {
          return await this.bookings.withManager(manager).assignMentor(booking.id, {
            mentorId: mentor.id,
            mentorTimezone: mentor.timezone,
            mentorLocalDate: localDateOf(booking.startsAt, mentor.timezone),
            mentorJoinToken: this.meetings.createMeeting().mentorJoinToken,
          });
        } catch (error) {
          if (isExclusionViolation(error, 'bookings_no_mentor_overlap')) return null;
          throw error;
        }
      },
    );
  }

  /**
   * Tries each mentor in its own savepoint: lock the mentor row, re-check it
   * under the lock, then `take`. A null from `take` rolls the savepoint back
   * (releasing that mentor's lock) and moves on.
   */
  private async firstThatTakes(
    manager: EntityManager,
    mentorIds: readonly string[],
    slot: { start: Temporal.Instant; excludeBookingId: string | undefined; window: BookingWindow },
    take: (mentor: LockedMentor) => Promise<BookingRecord | null>,
  ): Promise<BookingRecord | null> {
    for (const mentorId of mentorIds) {
      await manager.query(`SAVEPOINT ${SAVEPOINT}`);
      const mentor = await this.mentors.withManager(manager).lockById(mentorId);
      const free =
        mentor !== null &&
        mentor.isActive &&
        (await this.availability.isFreeUnderLock(
          manager,
          mentor.id,
          slot.start,
          slot.excludeBookingId,
          slot.window,
        ));
      const booking = free ? await take(mentor) : null;
      if (booking === null) {
        await manager.query(`ROLLBACK TO SAVEPOINT ${SAVEPOINT}`);
        continue;
      }
      await manager.query(`RELEASE SAVEPOINT ${SAVEPOINT}`);
      return booking;
    }
    return null;
  }

  private async insertFor(
    manager: EntityManager,
    placement: Placement,
    mentor: LockedMentor,
  ): Promise<BookingRecord | null> {
    const booking = this.config.booking;
    const endsAt = addMinutes(placement.slotStart, booking.trialDurationMinutes);
    const meeting = this.meetings.createMeeting();
    for (let attempt = 1; ; attempt += 1) {
      await manager.query(`SAVEPOINT ${SAVEPOINT}_insert`);
      try {
        const inserted = await this.bookings.withManager(manager).insert({
          reference: newBookingReference(),
          parentId: placement.parentId,
          studentId: placement.studentId,
          mentorId: mentor.id,
          startsAt: placement.slotStart,
          endsAt,
          blockedUntil: addMinutes(endsAt, booking.mentorBufferMinutes),
          mentorLocalDate: localDateOf(placement.slotStart, mentor.timezone),
          parentTimezone: placement.parentTimezone,
          mentorTimezone: mentor.timezone,
          parentJoinToken: meeting.parentJoinToken,
          mentorJoinToken: meeting.mentorJoinToken,
          meetingUrl: meeting.meetingUrl,
          rescheduledFromId: placement.rescheduledFromId,
          idempotencyKey: placement.idempotencyKey,
          requestFingerprint: placement.requestFingerprint,
          createdAt: this.clock.now(),
        });
        await manager.query(`RELEASE SAVEPOINT ${SAVEPOINT}_insert`);
        return inserted;
      } catch (error) {
        await manager.query(`ROLLBACK TO SAVEPOINT ${SAVEPOINT}_insert`);
        // Another booking took this mentor's time after our check: try the next mentor.
        if (isExclusionViolation(error, 'bookings_no_mentor_overlap')) return null;
        if (isUniqueViolation(error, 'bookings_reference_key') && attempt < REFERENCE_ATTEMPTS) {
          continue;
        }
        throw error;
      }
    }
  }
}
