import { Injectable } from '@nestjs/common';

import {
  type Booking,
  type BookingListQuery,
  type BookingListResponse,
  type BookingSummary,
  ErrorCode,
} from '@app/contracts';
import { isoInstant, toInstant } from '@app/time';

import { Clock } from '../../../common/clock/clock';
import { AppError } from '../../../common/errors/app-error';
import { AppConfig } from '../../../config/app-config';
import { MeetingProvider } from '../../classroom/domain/meeting-provider';
import { MentorsRepository } from '../../mentors/infra/mentors.repository';
import { StudentsRepository } from '../../students/infra/students.repository';
import { cancelProblem, rescheduleProblem } from '../domain/booking-rules';
import { type BookingRecord, BookingsRepository } from '../infra/bookings.repository';

import { buildCalendar } from './calendar';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function bookingNotFound(): AppError {
  return new AppError(ErrorCode.BOOKING_NOT_FOUND);
}

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

/** Opaque list cursor: the (start, id) of the last item of the previous page. */
export function encodeCursor(booking: BookingRecord): string {
  return Buffer.from(JSON.stringify([isoInstant(booking.startsAt), booking.id])).toString(
    'base64url',
  );
}

export function decodeCursor(cursor: string): {
  startsAt: ReturnType<typeof toInstant>;
  id: string;
} {
  try {
    const [start, id] = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown[];
    if (typeof start === 'string' && typeof id === 'string' && UUID.test(id)) {
      return { startsAt: toInstant(start), id };
    }
  } catch {
    // Falls through to the validation error below.
  }
  throw new AppError(ErrorCode.VALIDATION_FAILED, {
    detail: 'The cursor is not valid. Start again from the first page.',
    extras: { errors: [{ path: 'cursor', message: 'Invalid cursor' }] },
  });
}

/** Parent-facing booking views (docs/03 §9 `Booking`), always owner-scoped. */
@Injectable()
export class BookingViews {
  constructor(
    private readonly bookings: BookingsRepository,
    private readonly students: StudentsRepository,
    private readonly mentors: MentorsRepository,
    private readonly meetings: MeetingProvider,
    private readonly config: AppConfig,
    private readonly clock: Clock,
  ) {}

  /** @throws AppError BOOKING_NOT_FOUND for unknown, malformed or someone else's ids (E-23) */
  async get(parentId: string, id: string): Promise<Booking> {
    if (!isUuid(id)) throw bookingNotFound();
    const booking = await this.bookings.findOwned(parentId, id);
    if (booking === null) throw bookingNotFound();
    return this.toBooking(booking);
  }

  async list(parentId: string, query: BookingListQuery): Promise<BookingListResponse> {
    const after = query.cursor === undefined ? null : decodeCursor(query.cursor);
    // One extra row tells whether another page exists.
    const rows = await this.bookings.listPage(
      parentId,
      query.scope,
      this.clock.now(),
      after,
      query.limit + 1,
    );
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return {
      items: await this.toSummaries(parentId, page),
      nextCursor: rows.length > query.limit && last !== undefined ? encodeCursor(last) : null,
    };
  }

  private async toSummaries(parentId: string, page: BookingRecord[]): Promise<BookingSummary[]> {
    const students = await this.students.findOwnedMany(
      parentId,
      page.map((booking) => booking.studentId),
    );
    const mentors = await this.mentors.firstNames(page.map((booking) => booking.mentorId));
    const successors = await this.bookings.rescheduledToIds(page.map((booking) => booking.id));
    const now = this.clock.now();
    return page.map((booking) => ({
      id: booking.id,
      reference: booking.reference,
      status: booking.status,
      start: isoInstant(booking.startsAt),
      end: isoInstant(booking.endsAt),
      joinUrl: this.meetings.joinUrl(booking.parentJoinToken),
      canCancel: cancelProblem(booking, now) === null,
      canReschedule:
        rescheduleProblem(booking, now, this.config.booking.rescheduleCutoffMinutes) === null,
      rescheduledToId: successors.get(booking.id) ?? null,
      student: { firstName: students.get(booking.studentId)?.firstName ?? '' },
      mentor: { firstName: mentors.get(booking.mentorId) ?? '' },
    }));
  }

  /**
   * The booking as an .ics file for the parent's calendar (FR-B10). Only
   * confirmed trials: a moved or cancelled one has nothing left to add.
   */
  async calendarFile(parentId: string, id: string): Promise<{ filename: string; body: string }> {
    if (!isUuid(id)) throw bookingNotFound();
    const booking = await this.bookings.findOwned(parentId, id);
    if (booking === null) throw bookingNotFound();
    if (booking.status !== 'CONFIRMED') {
      throw new AppError(ErrorCode.BOOKING_NOT_MODIFIABLE, {
        detail: 'Only booked trials can be added to a calendar.',
        extras: { reason: 'NOT_CONFIRMED' },
      });
    }
    const view = await this.toBooking(booking);
    const joinUrl = view.joinUrl;
    return {
      filename: `codeyoung-trial-${booking.reference}.ics`,
      body: buildCalendar({
        method: 'PUBLISH',
        bookingId: booking.id,
        sequence: booking.icsSequence,
        start: booking.startsAt,
        end: booking.endsAt,
        title: `Codeyoung trial class for ${view.student.firstName}`,
        description:
          `${view.student.firstName}'s free coding trial with ${view.mentor.firstName}. ` +
          `Join the class: ${joinUrl}\nManage the booking: ${this.config.webBaseUrl}/bookings/${booking.id}`,
        url: joinUrl,
        stamp: this.clock.now(),
      }),
    };
  }

  async toBooking(booking: BookingRecord): Promise<Booking> {
    const student = await this.students.findOwned(booking.parentId, booking.studentId);
    const mentorNames = await this.mentors.firstNames([booking.mentorId]);
    const now = this.clock.now();
    return {
      id: booking.id,
      reference: booking.reference,
      status: booking.status,
      start: isoInstant(booking.startsAt),
      end: isoInstant(booking.endsAt),
      timezone: booking.parentTimezone as Booking['timezone'],
      student: {
        id: booking.studentId,
        firstName: student?.firstName ?? '',
        age: student?.age ?? 0,
      },
      mentor: { firstName: mentorNames.get(booking.mentorId) ?? '' },
      joinUrl: this.meetings.joinUrl(booking.parentJoinToken),
      canCancel: cancelProblem(booking, now) === null,
      canReschedule:
        rescheduleProblem(booking, now, this.config.booking.rescheduleCutoffMinutes) === null,
      rescheduledFromId: booking.rescheduledFromId,
      rescheduledToId: await this.bookings.rescheduledToId(booking.id),
      createdAt: isoInstant(booking.createdAt),
    };
  }
}
