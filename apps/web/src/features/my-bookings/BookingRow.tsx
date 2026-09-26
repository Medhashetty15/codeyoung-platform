import { Link } from 'react-router';

import type { BookingSummary } from '@app/contracts';
import { formatDate, formatTime, zoneParts } from '@app/time';

import { cn } from '../../shared/lib/cn';
import { buttonVariants } from '../../shared/ui/button-variants';
import { VideoCameraIcon } from '../../shared/ui/icons';
import { Reference } from '../../shared/ui/Reference';
import { StatusBadge } from '../../shared/ui/StatusBadge';
import { textLinkClassName } from '../../shared/ui/text-link';

import { inAppPath } from './booking-view';
import { BookingActionsMenu } from './BookingActionsMenu';
import { CalendarMenu } from './CalendarMenu';

interface BookingRowProps {
  booking: BookingSummary;
  zone: string;
  locale: string;
  /** The classroom is open now: "Join class" becomes the primary action. */
  classOpen: boolean;
  onCancel: (booking: BookingSummary) => void;
}

function DateTile({ start, zone, locale }: { start: string; zone: string; locale: string }) {
  return (
    <div
      aria-hidden
      className="flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-control bg-sunken"
    >
      <span className="text-h2 leading-none text-ink tabular-nums">
        {formatDate(start, zone, 'dayNumber', locale)}
      </span>
      <span className="mt-1 text-micro text-ink-muted uppercase">
        {formatDate(start, zone, 'monthShort', locale)}
      </span>
    </div>
  );
}

/** Join link: stays in the app when the class page is ours, a plain link otherwise. */
function JoinLink({ url, primary }: { url: string; primary: boolean }) {
  const className = buttonVariants({ variant: primary ? 'primary' : 'secondary' });
  const content = (
    <>
      <VideoCameraIcon aria-hidden size={20} />
      Join class
    </>
  );
  const path = inAppPath(url, window.location.origin);
  return path ? (
    <Link to={path} className={className}>
      {content}
    </Link>
  ) : (
    <a href={url} className={className}>
      {content}
    </a>
  );
}

/** One trial in My bookings (doc 05 §6.2): date tile, time in the parent's zone, then actions. */
export function BookingRow({ booking, zone, locale, classOpen, onCancel }: BookingRowProps) {
  const active = booking.status === 'CONFIRMED';
  const when = `${formatDate(booking.start, zone, 'weekday', locale)}, ${formatTime(booking.start, zone, locale)} ${zoneParts(zone, booking.start).name}`;
  const fullDate = formatDate(booking.start, zone, 'long', locale);

  return (
    <li className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-4 gap-y-4 rounded-surface bg-surface p-4 sm:p-5">
      <DateTile start={booking.start} zone={zone} locale={locale} />
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col items-start gap-0.5">
          <Link
            to={`/bookings/${booking.id}`}
            aria-label={`${booking.student.firstName}'s trial, ${fullDate}, ${formatTime(booking.start, zone, locale)} ${zoneParts(zone, booking.start).name}`}
            className="text-h3 font-bold text-ink tabular-nums hover:underline hover:decoration-line-control hover:underline-offset-4"
          >
            {when}
          </Link>
          <p className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 text-small text-ink-muted">
            <span>
              {booking.student.firstName} with {booking.mentor.firstName}
            </span>
            <span>
              Ref <Reference value={booking.reference} className="text-ink-muted" />
            </span>
          </p>
          <StatusBadge status={booking.status} className="mt-1.5" />
        </div>
        {active && (
          <div className="-mt-2 -mr-2 shrink-0">
            <BookingActionsMenu booking={booking} onCancel={onCancel} />
          </div>
        )}
      </div>

      {active && (
        // Phones: two full-width actions under the whole row; wider: inline under the text.
        <div className="col-span-2 grid gap-2 min-[480px]:col-span-1 min-[480px]:col-start-2 min-[480px]:flex min-[480px]:flex-wrap">
          <JoinLink url={booking.joinUrl} primary={classOpen} />
          <CalendarMenu booking={booking} />
        </div>
      )}

      {booking.status === 'RESCHEDULED' && booking.rescheduledToId && (
        <Link
          to={`/bookings/${booking.rescheduledToId}`}
          className={cn(textLinkClassName, 'col-start-2 justify-self-start')}
        >
          See the new time
        </Link>
      )}
    </li>
  );
}
