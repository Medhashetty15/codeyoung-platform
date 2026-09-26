import { Injectable } from '@nestjs/common';

import { isAfter, type Temporal, toInstant } from '@app/time';

import { Clock } from '../../../common/clock/clock';
import { isOutboxEventType } from '../domain/outbox-events';
import { type BookingContext, NotificationContextQuery } from '../infra/notification-context.query';

import { AccountEmails } from './account-emails';
import { BookingEmails } from './booking-emails';
import { type PlannedEmail } from './planned-email';

/** A message that can never succeed (unknown type, missing rows): no point retrying. */
export class PermanentFailure extends Error {
  override readonly name = 'PermanentFailure';
}

/**
 * Decides which emails a message produces from the current state (docs/03
 * §7.2). Invitations to a single booking (confirmation, reminder, new
 * mentor) are dropped once the class is no longer confirmed: the email that
 * explains why is its own message. Cancellations always go out.
 */
@Injectable()
export class NotificationPlanner {
  constructor(
    private readonly context: NotificationContextQuery,
    private readonly bookingEmails: BookingEmails,
    private readonly accountEmails: AccountEmails,
    private readonly clock: Clock,
  ) {}

  async plan(type: string, payload: Record<string, unknown>): Promise<PlannedEmail[]> {
    if (!isOutboxEventType(type)) throw new PermanentFailure(`Unknown message type ${type}`);
    switch (type) {
      case 'BookingConfirmed': {
        const booking = await this.booking(field(payload, 'bookingId'));
        return booking.status === 'CONFIRMED' ? this.bookingEmails.confirmed(booking) : [];
      }
      case 'BookingCancelled':
        return this.bookingEmails.cancelled(await this.booking(field(payload, 'bookingId')));
      case 'BookingRescheduled':
        return this.bookingEmails.rescheduled(
          await this.booking(field(payload, 'fromBookingId')),
          await this.booking(field(payload, 'toBookingId')),
        );
      case 'BookingReassigned': {
        const booking = await this.booking(field(payload, 'bookingId'));
        const previous = await this.context.mentor(field(payload, 'previousMentorId'));
        if (previous === null) throw new PermanentFailure('Previous mentor not found');
        const emails = this.bookingEmails.reassigned(booking, previous);
        return booking.status === 'CONFIRMED'
          ? emails
          : emails.filter((email) => email.template === 'booking-moved-away-mentor');
      }
      case 'BookingReminder': {
        const booking = await this.booking(field(payload, 'bookingId'));
        return this.reminderIsDue(booking, instantField(payload, 'startsAt'))
          ? this.bookingEmails.reminder(booking)
          : [];
      }
      case 'PasswordResetRequested': {
        const user = await this.user(field(payload, 'userId'));
        // A link that already expired would only confuse; the parent can ask again.
        if (!isAfter(instantField(payload, 'expiresAt'), this.clock.now())) return [];
        return this.accountEmails.passwordReset(user, field(payload, 'token'));
      }
      case 'PasswordChanged': {
        const reason = field(payload, 'reason');
        if (reason !== 'CHANGED' && reason !== 'RESET') {
          throw new PermanentFailure(`Unknown password change reason ${reason}`);
        }
        return this.accountEmails.passwordChanged(
          await this.user(field(payload, 'userId')),
          reason,
        );
      }
    }
  }

  /** E-17: still confirmed, not moved since it was scheduled, and not started yet. */
  private reminderIsDue(booking: BookingContext, scheduledStart: Temporal.Instant): boolean {
    return (
      booking.status === 'CONFIRMED' &&
      booking.startsAt.equals(scheduledStart) &&
      isAfter(booking.startsAt, this.clock.now())
    );
  }

  private async booking(id: string): Promise<BookingContext> {
    const booking = await this.context.booking(id);
    if (booking === null) throw new PermanentFailure(`Booking ${id} not found`);
    return booking;
  }

  private async user(id: string) {
    const user = await this.context.user(id);
    if (user === null) throw new PermanentFailure(`User ${id} not found`);
    return user;
  }
}

function field(payload: Record<string, unknown>, name: string): string {
  const value = payload[name];
  if (typeof value !== 'string') throw new PermanentFailure(`Payload field ${name} is missing`);
  return value;
}

function instantField(payload: Record<string, unknown>, name: string): Temporal.Instant {
  try {
    return toInstant(field(payload, name));
  } catch (error) {
    if (error instanceof PermanentFailure) throw error;
    throw new PermanentFailure(`Payload field ${name} is not an instant`);
  }
}
