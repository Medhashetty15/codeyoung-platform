import { type EntityManager } from 'typeorm';

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
    const row = await this.manager.findOne(BookingEntity, {
      select: { id: true },
      where: { rescheduledFromId: id },
    });
    return row?.id ?? null;
  }
}
