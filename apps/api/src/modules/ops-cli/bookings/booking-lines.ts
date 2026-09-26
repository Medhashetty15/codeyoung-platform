import { formatDateTime, zoneLabel } from '@app/time';

import { type OpsBookingLine } from '../../bookings/infra/ops-bookings.query';

/** "Sat 24 Oct, 21:30" in the mentor display zone (docs/04 §4: ops lists use IST). */
export function mentorTime(line: OpsBookingLine, mentorZone: string): string {
  return formatDateTime(line.startsAt, mentorZone, 'en-GB');
}

/** "Sat 24 Oct, 17:00 London time (GMT+1)": the class for the family. */
export function parentTime(line: OpsBookingLine): string {
  return `${formatDateTime(line.startsAt, line.parentTimezone, 'en-GB')} ${zoneLabel(line.parentTimezone, line.startsAt)}`;
}

/** Multi-line summary printed before a change (dry run). */
export function describeBooking(line: OpsBookingLine, mentorZone: string): string[] {
  return [
    `Booking ${line.reference} (${line.status})`,
    `  When:   ${mentorTime(line, mentorZone)} ${zoneLabel(mentorZone, line.startsAt)}; family: ${parentTime(line)}`,
    `  Child:  ${line.childFirstName}, ${String(line.childAge)}`,
    `  Parent: ${line.parentName} <${line.parentEmail}>`,
    `  Mentor: ${line.mentorName} <${line.mentorEmail}>`,
  ];
}
