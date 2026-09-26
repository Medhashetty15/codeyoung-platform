import { useQuery } from '@tanstack/react-query';
import { lazy, Suspense, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import type { Booking, Slot } from '@app/contracts';
import { formatDateTime, zoneParts } from '@app/time';

import {
  bookingConfigQuery,
  MobileSummaryBar,
  SlotPicker,
  TimeTraySummary,
  usePickTime,
} from '../features/availability';
import { forgetIdempotencyKey, idempotencyKeyFor, useBooking } from '../features/booking';
import { notModifiableText, useRescheduleBooking } from '../features/my-bookings';
import { ZoneChip } from '../features/timezone';
import { ApiError, isApiError } from '../shared/api/ApiError';
import { tooManyAttemptsText, unreachableText } from '../shared/api/error-copy';
import { Button } from '../shared/ui/Button';
import { EmptyState } from '../shared/ui/EmptyState';
import { MagnifyingGlassIcon } from '../shared/ui/icons';
import { Notice } from '../shared/ui/Notice';
import { notify } from '../shared/ui/notify';
import { PageTitle } from '../shared/ui/PageTitle';
import { Skeleton } from '../shared/ui/Skeleton';
import { textLinkClassName } from '../shared/ui/text-link';

// Dialogs load after the page (Base UI Dialog is too big for the first load) and mount closed.
const MoveDialog = lazy(() =>
  import('../features/my-bookings/MoveDialog').then((module) => ({ default: module.MoveDialog })),
);
const SlotTakenDialog = lazy(() =>
  import('../features/booking/SlotTakenDialog').then((module) => ({
    default: module.SlotTakenDialog,
  })),
);

const PAGE = 'mx-auto max-w-content px-4 pt-6 pb-32 sm:pt-10 lg:pb-16';

/** Codes the move flow answers with its own UI instead of the generic notice (doc 05 §5.4). */
const HANDLED = new Set([
  'NO_MENTOR_AVAILABLE',
  'SLOT_IN_PAST',
  'SLOT_OUTSIDE_HORIZON',
  'SLOT_NOT_ON_GRID',
]);

function moveErrorText(error: Error, cutoffMinutes: number): string {
  if (isApiError(error, 'BOOKING_NOT_MODIFIABLE')) {
    return notModifiableText(error.extras.reason, cutoffMinutes);
  }
  if (isApiError(error, 'RATE_LIMITED')) return tooManyAttemptsText(error);
  return unreachableText(error);
}

function MoveTrial({ booking }: { booking: Booking }) {
  const navigate = useNavigate();
  const config = useQuery(bookingConfigQuery());
  const current: Slot = { start: booking.start, end: booking.end };
  const picker = usePickTime({ current });
  const { zone, locale, date, selected } = picker;
  const move = useRescheduleBooking();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [alternatives, setAlternatives] = useState<Slot[] | null>(null);
  const cutoff = config.data?.rescheduleCutoffMinutes ?? 120;
  const from = formatDateTime(booking.start, zone, locale);

  const confirm = () => {
    if (!selected) return;
    const parts = ['reschedule', booking.id, selected.start, zone];
    move.mutate(
      {
        id: booking.id,
        body: { slotStart: selected.start, timezone: zone },
        idempotencyKey: idempotencyKeyFor(parts),
      },
      {
        onSuccess: (moved) => {
          forgetIdempotencyKey(parts);
          void navigate(`/bookings/${moved.id}?moved=1`, { replace: true });
        },
        onError: (error) => {
          if (!(error instanceof ApiError)) return;
          if (error.code === 'IDEMPOTENCY_KEY_REUSED') forgetIdempotencyKey(parts);
          if (error.code === 'NO_MENTOR_AVAILABLE') {
            setConfirmOpen(false);
            setAlternatives(
              Array.isArray(error.extras.alternatives) ? (error.extras.alternatives as Slot[]) : [],
            );
          }
          if (error.code.startsWith('SLOT_')) {
            setConfirmOpen(false);
            notify('That time can no longer be booked.');
            picker.update({ slot: null });
            void picker.slots.refetch();
          }
        },
      },
    );
  };

  const openConfirm = () => {
    if (!selected) return;
    move.reset();
    setConfirmOpen(true);
  };

  return (
    <div className={PAGE}>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <PageTitle>Pick a new time</PageTitle>
            <ZoneChip at={date ? `${date}T12:00:00Z` : undefined} />
          </div>
          <Notice>
            Moving {booking.student.firstName}&apos;s trial from {from}.
          </Notice>
          <SlotPicker
            picker={picker}
            empty={
              <Notice>
                Every trial class in this window is taken, so {booking.student.firstName}&apos;s
                trial stays on {from}.
              </Notice>
            }
          />
        </div>

        <aside aria-label="New time" className="hidden lg:block">
          <div className="sticky top-24">
            <TimeTraySummary
              slot={selected}
              zone={zone}
              locale={locale}
              actionLabel="Move trial"
              onAction={openConfirm}
            />
          </div>
        </aside>
      </div>
      <MobileSummaryBar
        slot={selected}
        zone={zone}
        locale={locale}
        actionLabel="Move trial"
        onAction={openConfirm}
      />

      <Suspense fallback={null}>
        <MoveDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          childName={booking.student.firstName}
          change={
            selected
              ? `${from} to ${formatDateTime(selected.start, zone, locale)}, ${zoneParts(zone, selected.start).name}.`
              : undefined
          }
          pending={move.isPending}
          error={
            move.error && !HANDLED.has(move.error instanceof ApiError ? move.error.code : '')
              ? moveErrorText(move.error, cutoff)
              : null
          }
          onConfirm={confirm}
        />
      </Suspense>

      <Suspense fallback={null}>
        <SlotTakenDialog
          open={alternatives !== null}
          alternatives={alternatives ?? []}
          zone={zone}
          locale={locale}
          allTimesHref={`/bookings/${booking.id}/reschedule?tz=${encodeURIComponent(zone)}${date ? `&date=${date}` : ''}`}
          onPick={(slot) => {
            setAlternatives(null);
            move.reset();
            picker.choose(slot);
          }}
          onClose={() => {
            setAlternatives(null);
          }}
        />
      </Suspense>
    </div>
  );
}

/** /bookings/:id/reschedule (doc 05 §6.4): the Pick a time screen around the booked time. */
export function Component() {
  const { id = '' } = useParams();
  const booking = useBooking(id);
  const config = useQuery(bookingConfigQuery());

  if (booking.isPending) {
    return (
      <div aria-busy="true" aria-label="Loading your trial" className={PAGE}>
        <Skeleton className="h-9 w-64" />
        <Skeleton radius="surface" className="mt-6 h-12 w-full max-w-2xl" />
      </div>
    );
  }
  if (booking.isError) {
    return (
      <div className={`${PAGE} flex flex-col gap-6`}>
        <PageTitle>Pick a new time</PageTitle>
        {isApiError(booking.error, 'BOOKING_NOT_FOUND') ? (
          <EmptyState icon={MagnifyingGlassIcon} title="We couldn't find that trial.">
            It may belong to another account. Your own trials are under My bookings.
          </EmptyState>
        ) : (
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
        )}
      </div>
    );
  }

  const trial = booking.data;
  if (trial.status !== 'CONFIRMED' || !trial.canReschedule) {
    return (
      <div className={`${PAGE} flex flex-col gap-6`}>
        <PageTitle>Pick a new time</PageTitle>
        <Notice
          action={
            <Link to={`/bookings/${trial.id}`} className={textLinkClassName}>
              Back to the trial
            </Link>
          }
        >
          {notModifiableText(
            trial.status === 'CONFIRMED' ? 'PAST_RESCHEDULE_CUTOFF' : 'NOT_CONFIRMED',
            config.data?.rescheduleCutoffMinutes ?? 120,
          )}
        </Notice>
      </div>
    );
  }
  return <MoveTrial booking={trial} />;
}
