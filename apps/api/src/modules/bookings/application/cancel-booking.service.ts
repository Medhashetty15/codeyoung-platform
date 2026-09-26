import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { type CancelReason, ErrorCode } from '@app/contracts';

import { Clock } from '../../../common/clock/clock';
import { AppError } from '../../../common/errors/app-error';
import { inLockingTransaction } from '../../../database/transactions';
import { OutboxWriter } from '../../notifications/infra/outbox-writer';
import { cancelProblem } from '../domain/booking-rules';
import { BookingEventsRepository } from '../infra/booking-events.repository';
import { type BookingRecord, BookingsRepository } from '../infra/bookings.repository';

import { bookingNotFound, isUuid } from './booking-views';

/** A parent cancels a confirmed class before it starts (FR-B8, E-12). */
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
      const bookings = this.bookings.withManager(manager);
      const booking = await bookings.lockOwned(parentId, id);
      if (booking === null) throw bookingNotFound();
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
      await bookings.markCancelled(booking.id, 'PARENT', reason ?? null, now);
      await this.events
        .withManager(manager)
        .append(booking.id, 'CANCELLED', `parent:${parentId}`, { reason: reason ?? null });
      await this.outbox.withManager(manager).enqueue('BookingCancelled', { bookingId: booking.id });
      const cancelled = await bookings.findOwned(parentId, booking.id);
      if (cancelled === null) throw bookingNotFound();
      return cancelled;
    });
  }
}
