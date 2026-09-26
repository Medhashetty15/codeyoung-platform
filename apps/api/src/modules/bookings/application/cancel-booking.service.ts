import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';

import { type CancelReason, ErrorCode } from '@app/contracts';

import { Clock } from '../../../common/clock/clock';
import { AppError } from '../../../common/errors/app-error';
import { inLockingTransaction } from '../../../database/transactions';
import { OutboxWriter } from '../../notifications/infra/outbox-writer';
import { cancelProblem } from '../domain/booking-rules';
import { BookingEventsRepository } from '../infra/booking-events.repository';
import { type CancelledBy } from '../infra/booking.entity';
import { type BookingRecord, BookingsRepository } from '../infra/bookings.repository';

import { bookingNotFound, isUuid } from './booking-views';

/** Cancels a confirmed class before it starts: parent (FR-B8, E-12) or ops (E-25). */
@Injectable()
export class CancelBookingService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly bookings: BookingsRepository,
    private readonly events: BookingEventsRepository,
    private readonly outbox: OutboxWriter,
    private readonly clock: Clock,
  ) {}

  async cancel(
    parentId: string,
    id: string,
    reason: CancelReason | undefined,
  ): Promise<BookingRecord> {
    if (!isUuid(id)) throw bookingNotFound();
    return inLockingTransaction(this.dataSource, async (manager) => {
      const booking = await this.bookings.withManager(manager).lockOwned(parentId, id);
      if (booking === null) throw bookingNotFound();
      return this.cancelLocked(manager, booking, {
        by: 'PARENT',
        reason: reason ?? null,
        actor: `parent:${parentId}`,
      });
    });
  }

  /** Ops cancellation by reference; the reason is required and goes into the parent's email. */
  async cancelAsOps(reference: string, reason: string, actor: string): Promise<BookingRecord> {
    return inLockingTransaction(this.dataSource, async (manager) => {
      const booking = await this.bookings.withManager(manager).lockByReference(reference);
      if (booking === null) throw bookingNotFound();
      return this.cancelLocked(manager, booking, { by: 'OPS', reason, actor });
    });
  }

  private async cancelLocked(
    manager: EntityManager,
    booking: BookingRecord,
    cancellation: { by: CancelledBy; reason: string | null; actor: string },
  ): Promise<BookingRecord> {
    const now = this.clock.now();
    const problem = cancelProblem(booking, now);
    if (problem !== null) {
      throw new AppError(ErrorCode.BOOKING_NOT_MODIFIABLE, {
        detail:
          problem === 'NOT_CONFIRMED'
            ? 'This trial is no longer booked.'
            : 'This trial has already started.',
        extras: { reason: problem },
      });
    }
    // Cancelling releases capacity, so no mentor lock is needed (docs/03 §3.4).
    const bookings = this.bookings.withManager(manager);
    await bookings.markCancelled(booking.id, cancellation.by, cancellation.reason, now);
    await this.events
      .withManager(manager)
      .append(booking.id, 'CANCELLED', cancellation.actor, { reason: cancellation.reason });
    await this.outbox.withManager(manager).enqueue('BookingCancelled', { bookingId: booking.id });
    const cancelled = await bookings.findByReference(booking.reference);
    if (cancelled === null) throw bookingNotFound();
    return cancelled;
  }
}
