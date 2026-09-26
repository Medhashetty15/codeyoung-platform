import { formatDateTime, zoneLabel } from '@app/time';

import { type BookingRecord } from '../../bookings/infra/bookings.repository';

/** "CY-7K3Q9  Sat 24 Oct, 21:30 Kolkata time (GMT+5:30)" per stranded class. */
export function affectedLines(bookings: readonly BookingRecord[], zone: string): string[] {
  return bookings.map(
    (booking) =>
      `  ${booking.reference}  ${formatDateTime(booking.startsAt, zone, 'en-GB')} ${zoneLabel(zone, booking.startsAt)}`,
  );
}
