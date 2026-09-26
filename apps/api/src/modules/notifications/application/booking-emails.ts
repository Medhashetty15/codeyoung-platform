import { Injectable } from '@nestjs/common';

import { Clock } from '../../../common/clock/clock';
import { AppConfig } from '../../../config/app-config';
import { buildCalendar } from '../../bookings/application/calendar';
import { MeetingProvider } from '../../classroom/domain/meeting-provider';
import { type BookingContext, type MentorContact } from '../infra/notification-context.query';
import { type MailCalendar } from '../mail/mail-transport';

import {
  classTime,
  classWhen,
  durationWords,
  relativeDay,
  shortDate,
  startTime,
} from './email-wording';
import { FOOTERS, type PlannedEmail } from './planned-email';

type Audience = 'parent' | 'mentor';

/**
 * Builds the booking emails of docs/03 §7.3 from the booking as it is now,
 * each recipient's times in their own zone (A-11, PD-06), with calendar
 * invitations that update or remove the event by UID and SEQUENCE.
 */
@Injectable()
export class BookingEmails {
  constructor(
    private readonly config: AppConfig,
    private readonly meetings: MeetingProvider,
    private readonly clock: Clock,
  ) {}

  confirmed(booking: BookingContext): PlannedEmail[] {
    return [
      this.parentEmail('booking-confirmed-parent', booking, this.invite(booking, 'parent')),
      this.mentorConfirmed(booking),
    ];
  }

  cancelled(booking: BookingContext): PlannedEmail[] {
    return [
      {
        template: 'booking-cancelled-parent',
        to: booking.parent,
        bookingId: booking.id,
        data: {
          ...this.parentData(booking),
          byParent: booking.cancelledBy !== 'OPS',
          bookUrl: `${this.config.webBaseUrl}/book`,
        },
        footer: FOOTERS.parent,
        calendar: this.cancellation(booking, 'parent'),
      },
      {
        template: 'booking-cancelled-mentor',
        to: booking.mentor,
        bookingId: booking.id,
        data: this.mentorData(booking, booking.mentor),
        footer: FOOTERS.mentor,
        calendar: this.cancellation(booking, 'mentor'),
      },
    ];
  }

  /** Parent: new time plus removal of the old event; old mentor: removal; new mentor: invite. */
  rescheduled(from: BookingContext, to: BookingContext): PlannedEmail[] {
    const oldEvent = this.cancellation(from, 'parent');
    return [
      {
        ...this.parentEmail('booking-rescheduled-parent', to, this.invite(to, 'parent')),
        data: {
          ...this.parentData(to),
          previousWhen: classWhen(from.startsAt, from.endsAt, to.parent.timezone),
        },
        attachments: [
          {
            filename: oldEvent.filename,
            content: oldEvent.content,
            contentType: calendarType('CANCEL'),
          },
        ],
      },
      this.movedAway(from, from.mentor, false),
      this.mentorConfirmed(to),
    ];
  }

  /** Same booking, new mentor: parent gets the update, the previous mentor a removal. */
  reassigned(booking: BookingContext, previous: MentorContact): PlannedEmail[] {
    return [
      this.parentEmail('booking-reassigned-parent', booking, this.invite(booking, 'parent')),
      this.movedAway(booking, previous, true),
      this.mentorConfirmed(booking),
    ];
  }

  reminder(booking: BookingContext): PlannedEmail[] {
    const now = this.clock.now();
    return [
      {
        ...this.parentEmail('booking-reminder-parent', booking),
        data: {
          ...this.parentData(booking),
          relativeDay: relativeDay(booking.startsAt, booking.parent.timezone, now),
          startTime: startTime(booking.startsAt, booking.parent.timezone),
        },
      },
      {
        template: 'booking-reminder-mentor',
        to: booking.mentor,
        bookingId: booking.id,
        data: {
          ...this.mentorData(booking, booking.mentor),
          relativeDay: relativeDay(booking.startsAt, booking.mentor.timezone, now),
          startTime: startTime(booking.startsAt, booking.mentor.timezone),
        },
        footer: FOOTERS.mentor,
      },
    ];
  }

  private parentEmail(
    template: PlannedEmail['template'],
    booking: BookingContext,
    calendar?: MailCalendar,
  ): PlannedEmail {
    return {
      template,
      to: booking.parent,
      bookingId: booking.id,
      data: this.parentData(booking),
      footer: FOOTERS.parent,
      ...(calendar === undefined ? {} : { calendar }),
    };
  }

  private mentorConfirmed(booking: BookingContext): PlannedEmail {
    return {
      template: 'booking-confirmed-mentor',
      to: booking.mentor,
      bookingId: booking.id,
      data: this.mentorData(booking, booking.mentor),
      footer: FOOTERS.mentor,
      calendar: this.invite(booking, 'mentor'),
    };
  }

  private movedAway(
    booking: BookingContext,
    mentor: MentorContact,
    reassigned: boolean,
  ): PlannedEmail {
    return {
      template: 'booking-moved-away-mentor',
      to: mentor,
      bookingId: booking.id,
      data: { ...this.mentorData(booking, mentor), reassigned },
      footer: FOOTERS.mentor,
      calendar: this.calendar('CANCEL', booking, 'mentor', mentor),
    };
  }

  private parentData(booking: BookingContext): Record<string, string | number | boolean> {
    const zone = booking.parent.timezone;
    return {
      parentFirstName: booking.parent.firstName,
      childFirstName: booking.child.firstName,
      mentorFirstName: booking.mentor.firstName,
      when: classWhen(booking.startsAt, booking.endsAt, zone),
      shortDate: shortDate(booking.startsAt, zone),
      joinUrl: this.meetings.joinUrl(booking.parentJoinToken),
      manageUrl: this.manageUrl(booking),
      opensBefore: durationWords(this.config.booking.classroomOpensMinutesBefore),
      rescheduleCutoff: durationWords(this.config.booking.rescheduleCutoffMinutes),
      reference: booking.reference,
    };
  }

  private mentorData(
    booking: BookingContext,
    mentor: MentorContact,
  ): Record<string, string | number | boolean> {
    const zone = mentor.timezone;
    return {
      mentorFirstName: mentor.firstName,
      childFirstName: booking.child.firstName,
      childAge: booking.child.age,
      when: classWhen(booking.startsAt, booking.endsAt, zone),
      shortDate: shortDate(booking.startsAt, zone),
      familyTime: classTime(booking.startsAt, booking.endsAt, booking.parent.timezone),
      joinUrl: this.meetings.joinUrl(booking.mentorJoinToken),
      reference: booking.reference,
    };
  }

  private invite(booking: BookingContext, audience: Audience): MailCalendar {
    return this.calendar(
      'REQUEST',
      booking,
      audience,
      audience === 'parent' ? booking.parent : booking.mentor,
    );
  }

  private cancellation(booking: BookingContext, audience: Audience): MailCalendar {
    return this.calendar(
      'CANCEL',
      booking,
      audience,
      audience === 'parent' ? booking.parent : booking.mentor,
    );
  }

  private calendar(
    method: MailCalendar['method'],
    booking: BookingContext,
    audience: Audience,
    attendee: { fullName: string; email: string },
  ): MailCalendar {
    const joinUrl = this.meetings.joinUrl(
      audience === 'parent' ? booking.parentJoinToken : booking.mentorJoinToken,
    );
    const child = booking.child.firstName;
    const from = this.config.mail.from;
    return {
      method,
      filename: method === 'CANCEL' ? 'cancelled-trial-class.ics' : 'trial-class.ics',
      content: buildCalendar({
        method,
        bookingId: booking.id,
        sequence: booking.icsSequence,
        start: booking.startsAt,
        end: booking.endsAt,
        title:
          audience === 'parent'
            ? `Codeyoung trial class for ${child}`
            : `Codeyoung trial class with ${child}`,
        description:
          audience === 'parent'
            ? `${child}'s free coding trial with ${booking.mentor.firstName}. Join the class: ${joinUrl}\nManage the booking: ${this.manageUrl(booking)}`
            : `Trial class with ${child} (age ${booking.child.age}). Join the class: ${joinUrl}`,
        url: joinUrl,
        stamp: this.clock.now(),
        organizer: { name: from.name === '' ? 'Codeyoung' : from.name, email: from.email },
        attendees: [{ name: attendee.fullName, email: attendee.email }],
      }),
    };
  }

  private manageUrl(booking: BookingContext): string {
    return `${this.config.webBaseUrl}/bookings/${booking.id}`;
  }
}

function calendarType(method: MailCalendar['method']): string {
  return `text/calendar; charset=utf-8; method=${method}`;
}
