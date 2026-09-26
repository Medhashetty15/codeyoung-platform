import type { Booking } from '@app/contracts';

/** "2026-10-24T16:00:00Z" -> "20261024T160000Z" (iCalendar basic UTC form). */
function basicUtc(iso: string): string {
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** "Add to Google Calendar" link; times are UTC so Google shows them in the parent's own zone. */
export function googleCalendarUrl(booking: Booking): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${booking.student.firstName}'s free coding trial with Codeyoung`,
    dates: `${basicUtc(booking.start)}/${basicUtc(booking.end)}`,
    details: `Join the class: ${booking.joinUrl}\nReference: ${booking.reference}`,
    location: booking.joinUrl,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
