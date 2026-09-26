import { Link, useParams, useSearchParams } from 'react-router';

import type { Booking } from '@app/contracts';
import { formatDate, formatDateTime, formatTime, zoneParts } from '@app/time';

import { useMe } from '../features/auth';
import { useBooking } from '../features/booking';
import { BeforeTheClass, BookingDetails, CalendarMenu, ManageTrial } from '../features/my-bookings';
import { useDisplayZone } from '../features/timezone';
import { isApiError } from '../shared/api/ApiError';
import { unreachableText } from '../shared/api/error-copy';
import { Button } from '../shared/ui/Button';
import { ConfirmedMark } from '../shared/ui/ConfirmedMark';
import { CopyButton } from '../shared/ui/CopyButton';
import { EmptyState } from '../shared/ui/EmptyState';
import { MagnifyingGlassIcon } from '../shared/ui/icons';
import { Notice } from '../shared/ui/Notice';
import { notify } from '../shared/ui/notify';
import { PageTitle } from '../shared/ui/PageTitle';
import { Skeleton } from '../shared/ui/Skeleton';
import { textLinkClassName } from '../shared/ui/text-link';

/** A moved trial links to the booking it became (doc 05 §6.3). */
function MovedTo({ booking, zone, locale }: { booking: Booking; zone: string; locale: string }) {
  const next = useBooking(booking.rescheduledToId);
  if (!booking.rescheduledToId) return null;
  return (
    <Link to={`/bookings/${booking.rescheduledToId}`} className={textLinkClassName}>
      {next.data ? `Moved to ${formatDateTime(next.data.start, zone, locale)}` : 'See the new time'}
    </Link>
  );
}

/**
 * /bookings/:id (doc 05 §6.3), with the confirmation hero when `?new=1` (§6.1) and a notice when
 * `?moved=1`. Cancelled, moved and completed trials are read-only.
 */
export function Component() {
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const isNew = searchParams.get('new') === '1';
  const isMoved = searchParams.get('moved') === '1';
  const booking = useBooking(id);
  const { data: me } = useMe();
  const { zone, locale } = useDisplayZone();

  if (booking.isPending) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading your trial"
        className="mx-auto flex max-w-content flex-col gap-6 px-4 py-6 sm:py-10"
      >
        <Skeleton className="h-9 w-72" />
        <Skeleton radius="surface" className="h-72 w-full max-w-2xl" />
      </div>
    );
  }
  if (booking.isError) {
    return (
      <div className="mx-auto flex max-w-content flex-col gap-6 px-4 py-6 sm:py-10">
        {isApiError(booking.error, 'BOOKING_NOT_FOUND') ? (
          <>
            <PageTitle>Trial not found</PageTitle>
            <EmptyState icon={MagnifyingGlassIcon} title="We couldn't find that trial.">
              It may belong to another account. Your own trials are under My bookings.
            </EmptyState>
          </>
        ) : (
          <>
            <PageTitle>Your trial</PageTitle>
            <Notice
              tone="danger"
              role="alert"
              action={
                <Button size="compact" variant="secondary" onClick={() => void booking.refetch()}>
                  Try again
                </Button>
              }
            >
              {unreachableText(booking.error)}
            </Notice>
          </>
        )}
      </div>
    );
  }

  const trial = booking.data;
  const when = `${formatDate(trial.start, zone, 'long', locale)}, ${formatTime(trial.start, zone, locale)} ${zoneParts(zone, trial.start).name}`;

  return (
    <div className="mx-auto flex max-w-content flex-col gap-8 px-4 py-6 sm:py-10">
      {isNew ? (
        <header className="flex flex-col items-start gap-4">
          <ConfirmedMark />
          <div className="confirmed-headline flex flex-col gap-2">
            <PageTitle>{trial.student.firstName}&apos;s trial is booked</PageTitle>
            <p className="max-w-prose text-body text-ink-muted tabular-nums">
              {when}.{me ? ` We have emailed the details to ${me.email}.` : ''}
            </p>
          </div>
        </header>
      ) : (
        <header className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <PageTitle>{trial.student.firstName}&apos;s trial</PageTitle>
            <p className="text-body text-ink-muted tabular-nums">{when}</p>
          </div>
          {isMoved && trial.status === 'CONFIRMED' && (
            <Notice role="status" className="max-w-2xl">
              Your trial has moved to {formatDateTime(trial.start, zone, locale)}.
            </Notice>
          )}
          {trial.status === 'RESCHEDULED' && (
            <MovedTo booking={trial} zone={zone} locale={locale} />
          )}
          {trial.status === 'CANCELLED' && (
            <p className="text-body text-ink-muted">
              This trial was cancelled.{' '}
              <Link to="/book" className={textLinkClassName}>
                Book another time
              </Link>
            </p>
          )}
        </header>
      )}

      {trial.status === 'CONFIRMED' && (
        <div className="flex flex-wrap gap-3">
          <CalendarMenu booking={trial} primary />
          <CopyButton
            value={trial.joinUrl}
            label="Copy class link"
            onCopied={() => {
              notify.success('Link copied');
            }}
            onError={() => {
              notify.error("We couldn't copy the link", { description: trial.joinUrl });
            }}
          />
        </div>
      )}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <BookingDetails booking={trial} />
        {trial.status === 'CONFIRMED' && (
          <div className="flex flex-col gap-10">
            <BeforeTheClass />
            <ManageTrial booking={trial} />
          </div>
        )}
      </div>
    </div>
  );
}
