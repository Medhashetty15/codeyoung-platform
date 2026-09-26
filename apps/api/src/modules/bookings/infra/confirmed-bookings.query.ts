import { type EntityManager } from 'typeorm';

import { fromDate, type LocalDate, type Temporal, toDate } from '@app/time';

import { BookingEntity } from './booking.entity';

export interface MentorBooking {
  mentorId: string;
  startsAt: Temporal.Instant;
  blockedUntil: Temporal.Instant;
  mentorLocalDate: LocalDate;
}

/** Confirmed bookings per mentor, for the slot engine's overlap and cap checks. */
export class ConfirmedBookingsQuery {
  constructor(private readonly manager: EntityManager) {}

  withManager(manager: EntityManager): ConfirmedBookingsQuery {
    return new ConfirmedBookingsQuery(manager);
  }

  /**
   * Bookings starting within `[from, to)`. Callers pad the range so every
   * booking on the mentor-local dates involved is counted towards the cap.
   */
  async forMentors(
    mentorIds: readonly string[],
    from: Temporal.Instant,
    to: Temporal.Instant,
    excludeBookingId?: string,
  ): Promise<MentorBooking[]> {
    if (mentorIds.length === 0) return [];
    const query = this.manager
      .createQueryBuilder(BookingEntity, 'booking')
      .select([
        'booking.mentorId',
        'booking.startsAt',
        'booking.blockedUntil',
        'booking.mentorLocalDate',
      ])
      .where('booking.status = :status', { status: 'CONFIRMED' })
      .andWhere('booking.mentorId IN (:...mentorIds)', { mentorIds })
      .andWhere('booking.startsAt >= :from AND booking.startsAt < :to', {
        from: toDate(from),
        to: toDate(to),
      });
    // A booking being rescheduled no longer counts against its own new slot.
    if (excludeBookingId !== undefined) {
      query.andWhere('booking.id <> :excludeBookingId', { excludeBookingId });
    }
    const rows = await query.getMany();
    return rows.map((row) => ({
      mentorId: row.mentorId,
      startsAt: fromDate(row.startsAt),
      blockedUntil: fromDate(row.blockedUntil),
      mentorLocalDate: row.mentorLocalDate,
    }));
  }
}
