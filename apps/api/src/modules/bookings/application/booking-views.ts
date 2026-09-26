import { Injectable } from '@nestjs/common';

import { type Booking, ErrorCode } from '@app/contracts';
import { isoInstant } from '@app/time';

import { Clock } from '../../../common/clock/clock';
import { AppError } from '../../../common/errors/app-error';
import { AppConfig } from '../../../config/app-config';
import { MeetingProvider } from '../../classroom/domain/meeting-provider';
import { MentorsRepository } from '../../mentors/infra/mentors.repository';
import { StudentsRepository } from '../../students/infra/students.repository';
import { cancelProblem, rescheduleProblem } from '../domain/booking-rules';
import { type BookingRecord, BookingsRepository } from '../infra/bookings.repository';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function bookingNotFound(): AppError {
  return new AppError(ErrorCode.BOOKING_NOT_FOUND);
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
    if (!UUID.test(id)) throw bookingNotFound();
    const booking = await this.bookings.findOwned(parentId, id);
    if (booking === null) throw bookingNotFound();
    return this.toBooking(booking);
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
