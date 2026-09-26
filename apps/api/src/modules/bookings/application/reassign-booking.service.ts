import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { ErrorCode } from '@app/contracts';

import { Clock } from '../../../common/clock/clock';
import { AppError } from '../../../common/errors/app-error';
import { inLockingTransaction } from '../../../database/transactions';
import { AvailabilityService } from '../../availability/application/availability.service';
import { MentorsRepository } from '../../mentors/infra/mentors.repository';
import { OutboxWriter } from '../../notifications/infra/outbox-writer';
import { LeastLoadedStrategy } from '../domain/assignment-strategy';
import { cancelProblem } from '../domain/booking-rules';
import { BookingEventsRepository } from '../infra/booking-events.repository';
import { type BookingRecord, BookingsRepository } from '../infra/bookings.repository';

import { BookingPlacer } from './booking-placer';
import { bookingNotFound } from './booking-views';
import { MentorLoads } from './mentor-loads';

export type ReassignOutcome =
  | { kind: 'reassigned'; booking: BookingRecord; previousMentorId: string }
  | { kind: 'no-mentor'; booking: BookingRecord };

/** Thrown inside the transaction so nothing it did survives. */
class NoMentorPlaced extends Error {}

/**
 * Ops moves a confirmed class to another mentor, same time (docs/03 §5.3,
 * E-25): least-loaded free mentor other than the current one, checked under
 * that mentor's lock; lead time does not apply. Emails via BookingReassigned.
 */
@Injectable()
export class ReassignBookingService {
  private readonly logger = new Logger(ReassignBookingService.name);
  private readonly strategy = new LeastLoadedStrategy();

  constructor(
    private readonly dataSource: DataSource,
    private readonly bookings: BookingsRepository,
    private readonly events: BookingEventsRepository,
    private readonly mentors: MentorsRepository,
    private readonly outbox: OutboxWriter,
    private readonly availability: AvailabilityService,
    private readonly loads: MentorLoads,
    private readonly placer: BookingPlacer,
    private readonly clock: Clock,
  ) {}

  /** Mentor ids that could take the class now, best first; empty when nobody can. */
  async candidates(reference: string): Promise<{ booking: BookingRecord; mentorIds: string[] }> {
    const booking = await this.bookings.findByReference(reference);
    if (booking === null) throw bookingNotFound();
    this.assertMovable(booking);
    const free = (await this.availability.candidates(booking.startsAt, booking.id, 'ops')).filter(
      (id) => id !== booking.mentorId,
    );
    const ranked = this.strategy.rank(await this.loads.forSlot(free, booking.startsAt));
    return { booking, mentorIds: ranked.map((load) => load.mentorId) };
  }

  async reassign(reference: string, actor: string): Promise<ReassignOutcome> {
    const { booking, mentorIds } = await this.candidates(reference);
    if (mentorIds.length === 0) return { kind: 'no-mentor', booking };
    try {
      return await inLockingTransaction(this.dataSource, async (manager) => {
        const locked = await this.bookings.withManager(manager).lockByReference(reference);
        if (locked === null) throw bookingNotFound();
        this.assertMovable(locked);
        const moved = await this.placer.reassign(manager, locked, mentorIds);
        if (moved === null) throw new NoMentorPlaced();
        await this.events.withManager(manager).append(moved.id, 'REASSIGNED', actor, {
          fromMentorId: locked.mentorId,
          toMentorId: moved.mentorId,
        });
        await this.outbox.withManager(manager).enqueue('BookingReassigned', {
          bookingId: moved.id,
          previousMentorId: locked.mentorId,
        });
        await this.mentors.withManager(manager).touchLastAssigned(moved.mentorId, this.clock.now());
        this.logger.log(
          { booking: moved.reference, from: locked.mentorId, to: moved.mentorId },
          'Booking reassigned',
        );
        return { kind: 'reassigned', booking: moved, previousMentorId: locked.mentorId } as const;
      });
    } catch (error) {
      if (error instanceof NoMentorPlaced) return { kind: 'no-mentor', booking };
      throw error;
    }
  }

  private assertMovable(booking: BookingRecord): void {
    const problem = cancelProblem(booking, this.clock.now());
    if (problem === null) return;
    throw new AppError(ErrorCode.BOOKING_NOT_MODIFIABLE, {
      detail:
        problem === 'NOT_CONFIRMED'
          ? `Booking ${booking.reference} is ${booking.status.toLowerCase()}, not confirmed.`
          : `Booking ${booking.reference} has already started.`,
      extras: { reason: problem },
    });
  }
}
