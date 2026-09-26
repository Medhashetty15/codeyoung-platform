import { useQuery } from '@tanstack/react-query';
import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router';

import type { Booking } from '@app/contracts';

import { Button } from '../../shared/ui/Button';
import { buttonVariants } from '../../shared/ui/button-variants';
import { bookingConfigQuery } from '../availability/queries';

import { durationPhrase } from './booking-view';

// Base UI Dialog loads after the page; it mounts closed, so opening it still transitions.
const CancelDialog = lazy(() =>
  import('./CancelDialog').then((module) => ({ default: module.CancelDialog })),
);

/**
 * Reschedule and cancel on the detail page (doc 05 §6.3). After the cutoff "Reschedule" stays
 * visible but disabled, with the reason next to it.
 */
export function ManageTrial({ booking }: { booking: Booking }) {
  const config = useQuery(bookingConfigQuery());
  const [cancelOpen, setCancelOpen] = useState(false);
  const cutoff = durationPhrase(config.data?.rescheduleCutoffMinutes ?? 120);
  const reasonId = `reschedule-reason-${booking.id}`;

  return (
    <section aria-labelledby="manage-trial" className="flex flex-col gap-3">
      <h2 id="manage-trial" className="text-h3 font-bold text-ink">
        Change of plans
      </h2>
      <p id={reasonId} className="text-small text-ink-muted">
        Trials can be moved up to {cutoff} before they start.
      </p>
      <div className="flex flex-wrap gap-2">
        {booking.canReschedule ? (
          <Link
            to={`/bookings/${booking.id}/reschedule`}
            className={buttonVariants({ variant: 'secondary' })}
          >
            Reschedule
          </Link>
        ) : (
          <Button variant="secondary" disabled aria-describedby={reasonId}>
            Reschedule
          </Button>
        )}
        {booking.canCancel && (
          <Button
            variant="secondary"
            onClick={() => {
              setCancelOpen(true);
            }}
          >
            Cancel trial
          </Button>
        )}
      </div>
      <Suspense fallback={null}>
        <CancelDialog booking={booking} open={cancelOpen} onOpenChange={setCancelOpen} />
      </Suspense>
    </section>
  );
}
