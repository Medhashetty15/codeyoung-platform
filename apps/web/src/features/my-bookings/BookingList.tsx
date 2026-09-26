import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router';

import type { BookingSummary } from '@app/contracts';

import { unreachableText } from '../../shared/api/error-copy';
import { useNow } from '../../shared/hooks/useNow';
import { Button } from '../../shared/ui/Button';
import { buttonVariants } from '../../shared/ui/button-variants';
import { EmptyState } from '../../shared/ui/EmptyState';
import { CalendarBlankIcon, ClockIcon } from '../../shared/ui/icons';
import { Notice } from '../../shared/ui/Notice';
import { Skeleton } from '../../shared/ui/Skeleton';
import { bookingConfigQuery } from '../availability/queries';
import { useDisplayZone } from '../timezone';

import { isClassWindowOpen } from './booking-view';
import { BookingRow } from './BookingRow';
import { bookingsQuery, type BookingScope } from './queries';

// Base UI Dialog loads after the page; it mounts closed, so opening it still transitions.
const CancelDialog = lazy(() =>
  import('./CancelDialog').then((module) => ({ default: module.CancelDialog })),
);

/** Rows in the shape of the loaded list (doc 07 §6 skeletons). */
function BookingRowsSkeleton() {
  return (
    <ul aria-hidden className="flex flex-col gap-3">
      {[0, 1, 2].map((row) => (
        <li
          key={row}
          className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-4 gap-y-4 rounded-surface bg-surface p-4 sm:p-5"
        >
          <Skeleton className="h-16 w-14" />
          <div className="flex flex-col gap-2 pt-1">
            <Skeleton className="h-5 w-56 max-w-full" />
            <Skeleton className="h-4 w-40 max-w-full" />
          </div>
          <Skeleton className="col-span-2 h-11 w-full min-[480px]:col-span-1 min-[480px]:col-start-2 min-[480px]:w-80" />
        </li>
      ))}
    </ul>
  );
}

interface BookingRowsProps {
  scope: BookingScope;
  onCancel: (booking: BookingSummary) => void;
}

function BookingRows({ scope, onCancel }: BookingRowsProps) {
  const { zone, locale } = useDisplayZone();
  const list = useInfiniteQuery(bookingsQuery(scope));
  const config = useQuery(bookingConfigQuery());
  const now = useNow();

  if (list.isPending) {
    return (
      <div aria-busy="true" aria-label="Loading your trials">
        <BookingRowsSkeleton />
      </div>
    );
  }
  if (list.isError) {
    return (
      <Notice
        tone="danger"
        role="alert"
        action={
          <Button size="compact" variant="secondary" onClick={() => void list.refetch()}>
            Try again
          </Button>
        }
      >
        {unreachableText(list.error)}
      </Notice>
    );
  }

  const bookings = list.data.pages.flatMap((page) => page.items);
  if (bookings.length === 0) {
    return scope === 'upcoming' ? (
      <EmptyState
        icon={CalendarBlankIcon}
        title="No trial booked yet."
        action={
          <Link to="/book" className={buttonVariants()}>
            Book a free trial
          </Link>
        }
      >
        Pick a time that suits your family and your child meets a mentor one to one.
      </EmptyState>
    ) : (
      <EmptyState icon={ClockIcon} title="No past trials.">
        Trials that have ended, been cancelled or moved show up here.
      </EmptyState>
    );
  }

  const opensMinutesBefore = config.data?.classroomOpensMinutesBefore ?? 10;
  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-col gap-3">
        {bookings.map((booking) => (
          <BookingRow
            key={booking.id}
            booking={booking}
            zone={zone}
            locale={locale}
            classOpen={isClassWindowOpen(booking, now, opensMinutesBefore)}
            onCancel={onCancel}
          />
        ))}
      </ul>
      {list.hasNextPage && (
        <Button
          variant="secondary"
          className="self-start"
          pending={list.isFetchingNextPage}
          onClick={() => void list.fetchNextPage()}
        >
          Show more
        </Button>
      )}
    </div>
  );
}

/**
 * One tab of My bookings: rows, "Show more" paging and the cancel dialog (doc 05 §6.2). The
 * dialog lives outside the rows so it can finish closing after the last trial is cancelled.
 */
export function BookingList({ scope }: { scope: BookingScope }) {
  const [cancelling, setCancelling] = useState<BookingSummary | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  return (
    <>
      <BookingRows
        scope={scope}
        onCancel={(target) => {
          setCancelling(target);
          setCancelOpen(true);
        }}
      />
      <Suspense fallback={null}>
        <CancelDialog booking={cancelling} open={cancelOpen} onOpenChange={setCancelOpen} />
      </Suspense>
    </>
  );
}
