import { describe, expect, it } from 'vitest';

import { Temporal } from '@app/time';

import { buildCalendar, type CalendarEvent } from './calendar';

const EVENT: CalendarEvent = {
  method: 'REQUEST',
  bookingId: '0b8f5c1e-3a2d-4c7e-9f10-2b3c4d5e6f70',
  sequence: 2,
  start: Temporal.Instant.from('2026-10-24T16:00:00Z'),
  end: Temporal.Instant.from('2026-10-24T17:00:00Z'),
  title: 'Codeyoung trial class for Leo',
  description: 'Join the class: http://localhost:5173/class/abc',
  url: 'http://localhost:5173/class/abc',
  stamp: Temporal.Instant.from('2026-10-20T09:00:00Z'),
  organizer: { name: 'Codeyoung', email: 'trials@codeyoung.dev' },
  attendees: [{ name: 'Hannah Okafor', email: 'hannah@example.com' }],
};

/** Unfolds RFC 5545 continuation lines so assertions see whole properties. */
function unfold(calendar: string): string {
  return calendar.replace(/\r\n[ \t]/g, '');
}

describe('buildCalendar', () => {
  it('writes an invitation with UTC times, stable UID, sequence, organizer and attendee', () => {
    const calendar = unfold(buildCalendar(EVENT));

    expect(calendar).toContain('METHOD:REQUEST');
    expect(calendar).toContain(`UID:${EVENT.bookingId}@codeyoung`);
    expect(calendar).toContain('SEQUENCE:2');
    expect(calendar).toContain('DTSTART:20261024T160000Z');
    expect(calendar).toContain('DTEND:20261024T170000Z');
    expect(calendar).toContain('DTSTAMP:20261020T090000Z');
    expect(calendar).toContain('STATUS:CONFIRMED');
    expect(calendar).toMatch(/ORGANIZER;CN="?Codeyoung"?:mailto:trials@codeyoung.dev/i);
    expect(calendar).toMatch(
      /ATTENDEE;[^\r\n]*CN="?Hannah Okafor"?[^\r\n]*:mailto:hannah@example.com/i,
    );
  });

  it('marks a cancellation as cancelled', () => {
    const calendar = unfold(buildCalendar({ ...EVENT, method: 'CANCEL', sequence: 3 }));

    expect(calendar).toContain('METHOD:CANCEL');
    expect(calendar).toContain('STATUS:CANCELLED');
    expect(calendar).toContain('SEQUENCE:3');
  });

  it('publishes a download without organizer or attendees', () => {
    const { organizer: _organizer, attendees: _attendees, ...download } = EVENT;
    const calendar = unfold(buildCalendar({ ...download, method: 'PUBLISH' }));

    expect(calendar).toContain('METHOD:PUBLISH');
    expect(calendar).not.toContain('ORGANIZER');
    expect(calendar).not.toContain('ATTENDEE');
  });
});
