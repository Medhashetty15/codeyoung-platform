import { createEvent, type EventAttributes } from 'ics';

import { type Temporal } from '@app/time';

/**
 * iCalendar method: PUBLISH for a file the parent downloads, REQUEST and
 * CANCEL for invitations attached to emails (docs/03 §7.3).
 */
export type CalendarMethod = 'PUBLISH' | 'REQUEST' | 'CANCEL';

export interface CalendarEvent {
  method: CalendarMethod;
  bookingId: string;
  /** Bumped on every change so calendar apps replace the event (ics_sequence). */
  sequence: number;
  start: Temporal.Instant;
  end: Temporal.Instant;
  title: string;
  description: string;
  url: string;
  /** DTSTAMP: when this version of the event was produced. */
  stamp: Temporal.Instant;
  organizer?: { name: string; email: string };
  /** Invitees of a REQUEST or CANCEL; calendar apps match the event to them. */
  attendees?: readonly { name: string; email: string }[];
}

/** Stable event identity: every version of a booking updates the same calendar entry. */
function calendarUid(bookingId: string): string {
  return `${bookingId}@codeyoung`;
}

/** An RFC 5545 calendar with one event, times in UTC so the client converts them itself. */
export function buildCalendar(event: CalendarEvent): string {
  // `timestamp` (DTSTAMP) is honoured by ics but missing from its typings.
  const attributes: EventAttributes & { timestamp: number } = {
    productId: 'codeyoung/trials',
    method: event.method,
    uid: calendarUid(event.bookingId),
    sequence: event.sequence,
    timestamp: event.stamp.epochMilliseconds,
    start: event.start.epochMilliseconds,
    startInputType: 'utc',
    startOutputType: 'utc',
    end: event.end.epochMilliseconds,
    endInputType: 'utc',
    endOutputType: 'utc',
    title: event.title,
    description: event.description,
    url: event.url,
    status: event.method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED',
    ...(event.organizer === undefined ? {} : { organizer: event.organizer }),
    ...(event.attendees === undefined
      ? {}
      : {
          attendees: event.attendees.map((attendee) => ({
            ...attendee,
            rsvp: false,
            role: 'REQ-PARTICIPANT' as const,
          })),
        }),
  };
  const { error, value } = createEvent(attributes);
  if (error !== null || value === null) {
    throw new Error('Could not build the calendar event', { cause: error });
  }
  return value;
}
