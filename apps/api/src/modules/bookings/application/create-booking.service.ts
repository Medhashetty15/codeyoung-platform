import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';

import { type BookingStudent, type CreateBookingRequest, ErrorCode } from '@app/contracts';
import { isoInstant, type Temporal, toInstant } from '@app/time';

import { Clock } from '../../../common/clock/clock';
import { AppError } from '../../../common/errors/app-error';
import { AppConfig } from '../../../config/app-config';
import { isUniqueViolation } from '../../../database/pg-errors';
import { inLockingTransaction } from '../../../database/transactions';
import { AvailabilityService } from '../../availability/application/availability.service';
import { MentorsRepository } from '../../mentors/infra/mentors.repository';
import { OutboxWriter } from '../../notifications/infra/outbox-writer';
import { StudentsRepository } from '../../students/infra/students.repository';
import { UsersRepository } from '../../users/infra/users.repository';
import { LeastLoadedStrategy } from '../domain/assignment-strategy';
import { slotProblem } from '../domain/booking-rules';
import { requestFingerprint } from '../domain/request-fingerprint';
import { BookingEventsRepository } from '../infra/booking-events.repository';
import { type BookingRecord, BookingsRepository } from '../infra/bookings.repository';

import { BookingPlacer } from './booking-placer';
import { MentorLoads } from './mentor-loads';

/** Most alternatives offered with NO_MENTOR_AVAILABLE (contracts MAX_ALTERNATIVES). */
const ALTERNATIVES = 3;

export interface BookingOutcome {
  booking: BookingRecord;
  /** True when the Idempotency-Key matched an earlier identical request (200, not 201). */
  replayed: boolean;
}

/** Thrown inside the transaction so everything it did (an inline child) rolls back. */
class NoMentorPlaced extends Error {}

/**
 * Books a trial (docs/03 §5.1, FR-B2 to FR-B6): idempotency, slot rules,
 * engine candidates ranked least-loaded first, then the capacity-safe insert
 * with audit event, confirmation and reminder outbox rows in one transaction.
 */
@Injectable()
export class CreateBookingService {
  private readonly strategy = new LeastLoadedStrategy();

  constructor(
    private readonly dataSource: DataSource,
    private readonly bookings: BookingsRepository,
    private readonly events: BookingEventsRepository,
    private readonly students: StudentsRepository,
    private readonly users: UsersRepository,
    private readonly mentors: MentorsRepository,
    private readonly outbox: OutboxWriter,
    private readonly availability: AvailabilityService,
    private readonly loads: MentorLoads,
    private readonly placer: BookingPlacer,
    private readonly config: AppConfig,
    private readonly clock: Clock,
  ) {}

  async create(
    parentId: string,
    request: CreateBookingRequest,
    idempotencyKey: string,
  ): Promise<BookingOutcome> {
    const fingerprint = requestFingerprint({
      action: 'create',
      slotStart: isoInstant(request.slotStart),
      timezone: request.timezone,
      student: request.student,
    });
    const replay = await this.replay(parentId, idempotencyKey, fingerprint);
    if (replay !== null) return replay;

    const slotStart = toInstant(request.slotStart);
    this.assertBookable(slotStart);
    const candidates = await this.availability.candidates(slotStart);
    if (candidates.length === 0) throw await this.noMentor(slotStart);
    const ranked = this.strategy.rank(await this.loads.forSlot(candidates, slotStart));

    try {
      const booking = await inLockingTransaction(this.dataSource, async (manager) => {
        const studentId = await this.resolveStudent(manager, parentId, request.student);
        await this.assertNoUpcomingTrial(manager, studentId);
        await this.users.withManager(manager).syncTimezone(parentId, request.timezone);

        const placed = await this.placer.place(manager, {
          slotStart,
          rankedMentorIds: ranked.map((load) => load.mentorId),
          parentId,
          studentId,
          parentTimezone: request.timezone,
          rescheduledFromId: null,
          idempotencyKey,
          requestFingerprint: fingerprint,
        });
        if (placed === null) throw new NoMentorPlaced();
        await this.recordCreated(manager, placed, `parent:${parentId}`);
        return placed;
      });
      return { booking, replayed: false };
    } catch (error) {
      // A twin request with the same key may have committed while this one ran
      // (it then sees "no mentor", "already has a trial" or a unique violation):
      // answer as its replay whatever the failure was.
      const concurrent = await this.replay(parentId, idempotencyKey, fingerprint);
      if (concurrent !== null) return concurrent;
      if (error instanceof NoMentorPlaced) throw await this.noMentor(slotStart);
      // Two bookings for one existing child raced past the pre-check.
      if (
        isUniqueViolation(error, 'bookings_one_upcoming_per_student') &&
        'id' in request.student
      ) {
        const upcoming = await this.bookings.upcomingForStudent(request.student.id);
        if (upcoming !== null) throw alreadyBookedError(upcoming.id);
      }
      throw error;
    }
  }

  /** Events and outbox rows for a new confirmed booking (also used by reschedule). */
  async recordCreated(
    manager: EntityManager,
    booking: BookingRecord,
    actor: string,
  ): Promise<void> {
    const now = this.clock.now();
    await this.events.withManager(manager).append(booking.id, 'CREATED', actor, {
      startsAt: isoInstant(booking.startsAt),
      mentorId: booking.mentorId,
    });
    const outbox = this.outbox.withManager(manager);
    if (booking.rescheduledFromId === null) {
      await outbox.enqueue('BookingConfirmed', { bookingId: booking.id });
    }
    for (const [kind, hours] of [
      ['24h', 24],
      ['1h', 1],
    ] as const) {
      const runAfter = booking.startsAt.subtract({ hours });
      // A reminder whose time has passed is not worth sending (docs/03 §5.1).
      if (runAfter.epochMilliseconds <= now.epochMilliseconds) continue;
      await outbox.enqueue(
        'BookingReminder',
        { bookingId: booking.id, kind, startsAt: isoInstant(booking.startsAt) },
        runAfter,
      );
    }
    await this.mentors.withManager(manager).touchLastAssigned(booking.mentorId, now);
  }

  /** @throws AppError SLOT_NOT_ON_GRID, SLOT_IN_PAST or SLOT_OUTSIDE_HORIZON */
  assertBookable(slotStart: Temporal.Instant): void {
    const problem = slotProblem(slotStart, this.clock.now(), {
      gridMinutes: this.config.booking.slotGridMinutes,
      leadMinutes: this.config.booking.leadTimeMinutes,
      horizonDays: this.config.booking.horizonDays,
    });
    if (problem === null) return;
    const details: Record<typeof problem, string> = {
      SLOT_NOT_ON_GRID: 'Classes start on the hour or half hour.',
      SLOT_IN_PAST: 'This time is too soon to book. Pick a later time.',
      SLOT_OUTSIDE_HORIZON: 'This time is too far ahead to book yet.',
    };
    throw new AppError(problem, { detail: details[problem] });
  }

  /** NO_MENTOR_AVAILABLE with the nearest free times (E-1). */
  async noMentor(slotStart: Temporal.Instant, excludeBookingId?: string): Promise<AppError> {
    return new AppError(ErrorCode.NO_MENTOR_AVAILABLE, {
      detail: 'This time was just taken. Here are the nearest available times.',
      extras: {
        alternatives: await this.availability.nearest(slotStart, ALTERNATIVES, excludeBookingId),
      },
    });
  }

  /** The booking an earlier request with this key produced, if the request matches (E-2). */
  async replay(
    parentId: string,
    idempotencyKey: string,
    fingerprint: string,
  ): Promise<BookingOutcome | null> {
    const existing = await this.bookings.findByIdempotencyKey(parentId, idempotencyKey);
    if (existing === null) return null;
    if (existing.requestFingerprint !== fingerprint) {
      throw new AppError(ErrorCode.IDEMPOTENCY_KEY_REUSED, {
        detail: 'This Idempotency-Key was already used for a different booking request.',
      });
    }
    return { booking: existing, replayed: true };
  }

  /** An existing child of this parent, or a new one created inline (FR-C1). */
  private async resolveStudent(
    manager: EntityManager,
    parentId: string,
    student: BookingStudent,
  ): Promise<string> {
    const students = this.students.withManager(manager);
    if ('id' in student) {
      const owned = await students.findOwned(parentId, student.id);
      if (owned === null) throw new AppError(ErrorCode.STUDENT_NOT_FOUND);
      return owned.id;
    }
    await manager.query('SAVEPOINT booking_student');
    try {
      const created = await students.insert(parentId, student);
      await manager.query('RELEASE SAVEPOINT booking_student');
      return created.id;
    } catch (error) {
      await manager.query('ROLLBACK TO SAVEPOINT booking_student');
      if (isUniqueViolation(error, 'students_parent_name')) {
        throw new AppError(ErrorCode.STUDENT_NAME_TAKEN, {
          detail: `You already added a child called ${student.firstName}. Choose them instead.`,
        });
      }
      throw error;
    }
  }

  private async assertNoUpcomingTrial(manager: EntityManager, studentId: string): Promise<void> {
    const upcoming = await this.bookings.withManager(manager).upcomingForStudent(studentId);
    if (upcoming !== null) throw alreadyBookedError(upcoming.id);
  }
}

function alreadyBookedError(bookingId: string): AppError {
  return new AppError(ErrorCode.STUDENT_ALREADY_HAS_TRIAL, {
    detail: 'This child already has an upcoming trial.',
    extras: { bookingId },
  });
}
