import { Injectable } from '@nestjs/common';
import { type EntityManager } from 'typeorm';

import { addMinutes, localDateOf, type Temporal } from '@app/time';

import { Clock } from '../../../common/clock/clock';
import { AppConfig } from '../../../config/app-config';
import { isExclusionViolation, isUniqueViolation } from '../../../database/pg-errors';
import { AvailabilityService } from '../../availability/application/availability.service';
import { MeetingProvider } from '../../classroom/domain/meeting-provider';
import { MentorsRepository } from '../../mentors/infra/mentors.repository';
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
    for (const mentorId of placement.rankedMentorIds) {
      await manager.query(`SAVEPOINT ${SAVEPOINT}`);
      const booking = await this.tryMentor(manager, placement, mentorId);
      if (booking === null) {
        await manager.query(`ROLLBACK TO SAVEPOINT ${SAVEPOINT}`);
        continue;
      }
      await manager.query(`RELEASE SAVEPOINT ${SAVEPOINT}`);
      return booking;
    }
    return null;
  }

  private async tryMentor(
    manager: EntityManager,
    placement: Placement,
    mentorId: string,
  ): Promise<BookingRecord | null> {
    const mentor = await this.mentors.withManager(manager).lockById(mentorId);
    if (mentor === null || !mentor.isActive) return null;
    const free = await this.availability.isFreeUnderLock(
      manager,
      mentor.id,
      placement.slotStart,
      placement.excludeBookingId,
    );
    if (!free) return null;

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
