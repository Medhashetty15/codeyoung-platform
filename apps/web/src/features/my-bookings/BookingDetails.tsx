import type { ReactNode } from 'react';

import type { Booking } from '@app/contracts';
import { formatDate, formatTimeRange, zoneLabel } from '@app/time';

import { Reference } from '../../shared/ui/Reference';
import { StatusBadge } from '../../shared/ui/StatusBadge';
import { useDisplayZone, ZoneChip } from '../timezone';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-4 border-b border-line py-3 last:border-b-0 sm:grid-cols-[9rem_minmax(0,1fr)]">
      <dt className="text-small text-ink-muted">{label}</dt>
      <dd className="text-body text-ink">{children}</dd>
    </div>
  );
}

/** Reference, child, mentor and time, with a way to read the time in another zone (doc 05 §6.1). */
export function BookingDetails({ booking }: { booking: Booking }) {
  const { zone, locale } = useDisplayZone();
  return (
    <section
      aria-labelledby="booking-details"
      className="rounded-surface border border-line bg-surface px-5 py-2 sm:px-6"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line py-4">
        <h2 id="booking-details" className="text-h3 font-bold text-ink">
          Trial details
        </h2>
        <StatusBadge status={booking.status} />
      </div>
      <dl>
        <Row label="Reference">
          <Reference value={booking.reference} />
        </Row>
        <Row label="Child">
          {booking.student.firstName}, {booking.student.age}
        </Row>
        <Row label="Mentor">{booking.mentor.firstName}</Row>
        <Row label="When">
          <span className="flex flex-col gap-1 tabular-nums">
            <time dateTime={booking.start}>{formatDate(booking.start, zone, 'long', locale)}</time>
            <span>
              {formatTimeRange(booking.start, booking.end, zone, locale)}{' '}
              {zoneLabel(zone, booking.start)}
            </span>
          </span>
          <span className="mt-3 flex flex-col items-start gap-2">
            <span className="text-small text-ink-muted">View in another time zone</span>
            <ZoneChip at={booking.start} />
          </span>
        </Row>
      </dl>
    </section>
  );
}

/** Doc 05 §6.1 "Before the class". */
export function BeforeTheClass() {
  return (
    <section aria-labelledby="before-class" className="flex flex-col gap-3">
      <h2 id="before-class" className="text-h3 font-bold text-ink">
        Before the class
      </h2>
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-body text-ink-muted marker:text-ink-faint">
        <li>A laptop or tablet with a camera and microphone.</li>
        <li>A quiet spot where your child can focus for an hour.</li>
        <li>Join 5 minutes early so you can check sound and video.</li>
      </ul>
    </section>
  );
}
