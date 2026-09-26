import { Brackets, type EntityManager, In } from 'typeorm';

import { type BookingStatus } from '@app/contracts';
import { fromDate, type LocalDate, type Temporal, toDate } from '@app/time';

import { BookingEntity, type CancelledBy } from './booking.entity';

export interface BookingRecord {
  id: string;
  reference: string;
  parentId: string;
  studentId: string;
  mentorId: string;
  startsAt: Temporal.Instant;
  endsAt: Temporal.Instant;
  blockedUntil: Temporal.Instant;
  mentorLocalDate: LocalDate;
  parentTimezone: string;
  mentorTimezone: string;
  status: BookingStatus;
  cancelledBy: CancelledBy | null;
  cancelReason: string | null;
  cancelledAt: Temporal.Instant | null;
  rescheduledFromId: string | null;
  parentJoinToken: string;
  mentorJoinToken: string;
  meetingUrl: string;
  icsSequence: number;
  requestFingerprint: string | null;
  createdAt: Temporal.Instant;
}

export interface NewBooking {
  reference: string;
  parentId: string;
  studentId: string;
  mentorId: string;
  startsAt: Temporal.Instant;
  endsAt: Temporal.Instant;
  blockedUntil: Temporal.Instant;
  mentorLocalDate: LocalDate;
  parentTimezone: string;
  mentorTimezone: string;
  parentJoinToken: string;
  mentorJoinToken: string;
  meetingUrl: string;
  rescheduledFromId: string | null;
  idempotencyKey: string | null;
  requestFingerprint: string | null;
  /** Business time from the injected Clock, not the database clock. */
  createdAt: Temporal.Instant;
}

export function toBookingRecord(row: BookingEntity): BookingRecord {
  return {
    id: row.id,
    reference: row.reference,
    parentId: row.parentId,
    studentId: row.studentId,
    mentorId: row.mentorId,
    startsAt: fromDate(row.startsAt),
    endsAt: fromDate(row.endsAt),
    blockedUntil: fromDate(row.blockedUntil),
    mentorLocalDate: row.mentorLocalDate,
    parentTimezone: row.parentTimezone,
    mentorTimezone: row.mentorTimezone,
    status: row.status,
    cancelledBy: row.cancelledBy,
    cancelReason: row.cancelReason,
    cancelledAt: row.cancelledAt && fromDate(row.cancelledAt),
    rescheduledFromId: row.rescheduledFromId,
    parentJoinToken: row.parentJoinToken,
    mentorJoinToken: row.mentorJoinToken,
    meetingUrl: row.meetingUrl,
    icsSequence: row.icsSequence,
    requestFingerprint: row.requestFingerprint,
    createdAt: fromDate(row.createdAt),
  };
}

/** Bookings table. Parent-facing reads are always scoped by parent (E-23). */
export class BookingsRepository {
  constructor(private readonly manager: EntityManager) {}

  withManager(manager: EntityManager): BookingsRepository {
    return new BookingsRepository(manager);
  }

  /** @throws QueryFailedError 23P01 (mentor overlap) or 23505 (student / key / reference). */
  async insert(booking: NewBooking): Promise<BookingRecord> {
    const row = await this.manager.save(
      this.manager.create(BookingEntity, {
        ...booking,
        startsAt: toDate(booking.startsAt),
        endsAt: toDate(booking.endsAt),
        blockedUntil: toDate(booking.blockedUntil),
        createdAt: toDate(booking.createdAt),
      }),
    );
    return toBookingRecord(row);
  }

  async findOwned(parentId: string, id: string): Promise<BookingRecord | null> {
    const row = await this.manager.findOneBy(BookingEntity, { id, parentId });
    return row && toBookingRecord(row);
  }

  /** Row-locks a parent's booking for a state change. */
  async lockOwned(parentId: string, id: string): Promise<BookingRecord | null> {
    const row = await this.manager.findOne(BookingEntity, {
      where: { id, parentId },
      lock: { mode: 'pessimistic_write' },
    });
    return row && toBookingRecord(row);
  }

  async findByIdempotencyKey(parentId: string, key: string): Promise<BookingRecord | null> {
    const row = await this.manager.findOneBy(BookingEntity, { parentId, idempotencyKey: key });
    return row && toBookingRecord(row);
  }

  /** The student's confirmed trial, if any (FR-B5). */
  async upcomingForStudent(studentId: string): Promise<BookingRecord | null> {
    const row = await this.manager.findOneBy(BookingEntity, { studentId, status: 'CONFIRMED' });
    return row && toBookingRecord(row);
  }

  /** Id of the booking this one was rescheduled into, if any. */
  async rescheduledToId(id: string): Promise<string | null> {
    return (await this.rescheduledToIds([id])).get(id) ?? null;
  }

  async rescheduledToIds(ids: readonly string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = await this.manager.find(BookingEntity, {
      select: { id: true, rescheduledFromId: true },
      where: { rescheduledFromId: In([...ids]) },
    });
    return new Map(
      rows.flatMap((row) =>
        row.rescheduledFromId === null ? [] : [[row.rescheduledFromId, row.id]],
      ),
    );
  }

  /**
   * A page of a parent's bookings. Upcoming = confirmed and not yet ended,
   * soonest first; past = everything else, latest first. Keyset pagination on
   * (starts_at, id) so pages stay stable while bookings change.
   */
  async listPage(
    parentId: string,
    scope: 'upcoming' | 'past',
    now: Temporal.Instant,
    after: { startsAt: Temporal.Instant; id: string } | null,
    limit: number,
  ): Promise<BookingRecord[]> {
    const upcoming = scope === 'upcoming';
    const direction = upcoming ? 'ASC' : 'DESC';
    const query = this.manager
      .createQueryBuilder(BookingEntity, 'booking')
      .where('booking.parentId = :parentId', { parentId })
      .andWhere(
        upcoming
          ? `booking.status = 'CONFIRMED' AND booking.endsAt > :now`
          : `NOT (booking.status = 'CONFIRMED' AND booking.endsAt > :now)`,
        { now: toDate(now) },
      )
      .orderBy('booking.startsAt', direction)
      .addOrderBy('booking.id', direction)
      .take(limit);
    if (after !== null) {
      const comparison = upcoming ? '>' : '<';
      query.andWhere(
        new Brackets((clause) => {
          clause
            .where(`booking.startsAt ${comparison} :afterStart`)
            .orWhere(`booking.startsAt = :afterStart AND booking.id ${comparison} :afterId`);
        }),
        { afterStart: toDate(after.startsAt), afterId: after.id },
      );
    }
    return (await query.getMany()).map(toBookingRecord);
  }

  /** Parent or ops cancellation: frees capacity at once (E-12); calendars get a new sequence. */
  async markCancelled(
    id: string,
    by: CancelledBy,
    reason: string | null,
    at: Temporal.Instant,
  ): Promise<void> {
    await this.manager
      .createQueryBuilder()
      .update(BookingEntity)
      .set({
        status: 'CANCELLED',
        cancelledBy: by,
        cancelReason: reason,
        cancelledAt: toDate(at),
        icsSequence: () => 'ics_sequence + 1',
      })
      .where('id = :id', { id })
      .execute();
  }

  /** The old side of a reschedule: no longer confirmed, so its time and cap are free. */
  async markRescheduled(id: string): Promise<void> {
    await this.manager
      .createQueryBuilder()
      .update(BookingEntity)
      .set({ status: 'RESCHEDULED', icsSequence: () => 'ics_sequence + 1' })
      .where('id = :id', { id })
      .execute();
  }
}
