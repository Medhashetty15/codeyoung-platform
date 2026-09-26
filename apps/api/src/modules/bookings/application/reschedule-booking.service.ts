import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { ErrorCode, type RescheduleBookingRequest } from '@app/contracts';
import { isoInstant, toInstant } from '@app/time';

import { Clock } from '../../../common/clock/clock';
import { AppError } from '../../../common/errors/app-error';
import { AppConfig } from '../../../config/app-config';
import { inLockingTransaction } from '../../../database/transactions';
import { AvailabilityService } from '../../availability/application/availability.service';
import { OutboxWriter } from '../../notifications/infra/outbox-writer';
import { UsersRepository } from '../../users/infra/users.repository';
import { LeastLoadedStrategy } from '../domain/assignment-strategy';
import { type BookingState, rescheduleProblem } from '../domain/booking-rules';
import { requestFingerprint } from '../domain/request-fingerprint';
import { BookingEventsRepository } from '../infra/booking-events.repository';
import { BookingsRepository } from '../infra/bookings.repository';

import { BookingPlacer } from './booking-placer';
import { bookingNotFound, isUuid } from './booking-views';
import { type BookingOutcome, CreateBookingService } from './create-booking.service';
import { MentorLoads } from './mentor-loads';

/** Thrown inside the transaction so the old booking is left untouched. */
class NoMentorPlaced extends Error {}

function cutoffText(minutes: number): string {
  if (minutes % 60 !== 0) return `${minutes} minutes`;
  const hours = minutes / 60;
  return hours === 1 ? '1 hour' : `${hours} hours`;
}

/**
 * Moves a trial to another time (FR-B9, E-13) in one transaction: the old
 * booking becomes RESCHEDULED (freeing its mentor time and cap) and the new
 * one is placed like any booking, possibly with another mentor. If no mentor
 * can take the new time, everything rolls back and the old booking stands.
 */
@Injectable()
export class RescheduleBookingService {
  private readonly strategy = new LeastLoadedStrategy();

  constructor(
    private readonly dataSource: DataSource,
    private readonly bookings: BookingsRepository,
    private readonly events: BookingEventsRepository,
    private readonly users: UsersRepository,
    private readonly outbox: OutboxWriter,
    private readonly availability: AvailabilityService,
    private readonly loads: MentorLoads,
    private readonly placer: BookingPlacer,
    private readonly creator: CreateBookingService,
    private readonly config: AppConfig,
    private readonly clock: Clock,
  ) {}

  async reschedule(
    parentId: string,
    id: string,
    request: RescheduleBookingRequest,
    idempotencyKey: string,
  ): Promise<BookingOutcome> {
    if (!isUuid(id)) throw bookingNotFound();
    const fingerprint = requestFingerprint({
      action: `reschedule:${id}`,
      slotStart: isoInstant(request.slotStart),
      timezone: request.timezone,
    });
    const replay = await this.creator.replay(parentId, idempotencyKey, fingerprint);
    if (replay !== null) return replay;

    const current = await this.bookings.findOwned(parentId, id);
    if (current === null) throw bookingNotFound();
    this.assertReschedulable(current);
    const slotStart = toInstant(request.slotStart);
    this.creator.assertBookable(slotStart);
    const candidates = await this.availability.candidates(slotStart, current.id);
    if (candidates.length === 0) throw await this.creator.noMentor(slotStart, current.id);
    const ranked = this.strategy.rank(await this.loads.forSlot(candidates, slotStart));
    const actor = `parent:${parentId}`;

    try {
      const booking = await inLockingTransaction(this.dataSource, async (manager) => {
        const bookings = this.bookings.withManager(manager);
        const old = await bookings.lockOwned(parentId, id);
        if (old === null) throw bookingNotFound();
        this.assertReschedulable(old);
        await bookings.markRescheduled(old.id);

        const placed = await this.placer.place(manager, {
          slotStart,
          rankedMentorIds: ranked.map((load) => load.mentorId),
          parentId,
          studentId: old.studentId,
          parentTimezone: request.timezone,
          rescheduledFromId: old.id,
          idempotencyKey,
          requestFingerprint: fingerprint,
          excludeBookingId: old.id,
        });
        if (placed === null) throw new NoMentorPlaced();

        const events = this.events.withManager(manager);
        await events.append(old.id, 'RESCHEDULED_TO', actor, { bookingId: placed.id });
        await events.append(placed.id, 'RESCHEDULED_FROM', actor, { bookingId: old.id });
        await this.creator.recordCreated(manager, placed, actor);
        await this.users.withManager(manager).syncTimezone(parentId, request.timezone);
        await this.outbox
          .withManager(manager)
          .enqueue('BookingRescheduled', { fromBookingId: old.id, toBookingId: placed.id });
        return placed;
      });
      return { booking, replayed: false };
    } catch (error) {
      const concurrent = await this.creator.replay(parentId, idempotencyKey, fingerprint);
      if (concurrent !== null) return concurrent;
      if (error instanceof NoMentorPlaced) throw await this.creator.noMentor(slotStart, id);
      throw error;
    }
  }

  private assertReschedulable(booking: BookingState): void {
    const problem = rescheduleProblem(
      booking,
      this.clock.now(),
      this.config.booking.rescheduleCutoffMinutes,
    );
    if (problem !== null) {
      const cutoff = this.config.booking.rescheduleCutoffMinutes;
      const details = {
        NOT_CONFIRMED: 'This trial is no longer booked.',
        ALREADY_STARTED: 'This trial has already started.',
        PAST_RESCHEDULE_CUTOFF: `Trials can be moved until ${cutoffText(cutoff)} before they start.`,
      };
      throw new AppError(ErrorCode.BOOKING_NOT_MODIFIABLE, {
        detail: details[problem],
        extras: { reason: problem },
      });
    }
  }
}
