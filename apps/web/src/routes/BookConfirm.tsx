import { useQuery } from '@tanstack/react-query';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';

import type { Slot } from '@app/contracts';
import { formatDateTime, localDateOf, zoneParts } from '@app/time';

import { useSessionStatus } from '../features/auth';
import { findSlot, parseBookSearch, slotsQuery, TimeTraySummary } from '../features/availability';
import { ConfirmPanel, nearestFree } from '../features/booking';
import { useDisplayZone } from '../features/timezone';
import { Button } from '../shared/ui/Button';
import { buttonVariants } from '../shared/ui/button-variants';
import { Notice } from '../shared/ui/Notice';
import { PageTitle } from '../shared/ui/PageTitle';
import { Skeleton } from '../shared/ui/Skeleton';
import { Stepper } from '../shared/ui/Stepper';
import { textLinkClassName } from '../shared/ui/text-link';

import { BOOKING_STEPS } from './booking-steps';

const AccountPanel = lazy(() =>
  import('../features/booking/account').then((module) => ({ default: module.AccountPanel })),
);

/** How long the Account panel takes to leave before the Confirm panel arrives (motion row 12). */
const PANEL_EXIT_MS = 150;

/**
 * /book/confirm?slot=&tz= (doc 05 §5.2 to 5.4). The slot is re-checked on arrival; signed-out
 * parents create an account or log in inline, then the Confirm panel replaces it in place.
 */
export function Component() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const { slot: slotStart } = parseBookSearch(searchParams);
  const { zone, locale } = useDisplayZone();
  const status = useSessionStatus();
  const slots = useQuery({ ...slotsQuery(zone), refetchOnMount: 'always' });
  const [panel, setPanel] = useState<'account' | 'confirm'>(
    status === 'authenticated' ? 'confirm' : 'account',
  );
  const [leaving, setLeaving] = useState(false);
  const [previousStatus, setPreviousStatus] = useState(status);
  if (status !== previousStatus) {
    setPreviousStatus(status);
    if (status === 'authenticated') {
      // Signing in on this page swaps the panels with motion; a session found at boot does not.
      if (previousStatus === 'anonymous') setLeaving(true);
      else setPanel('confirm');
    } else if (status === 'anonymous') {
      setLeaving(false);
      setPanel('account');
    }
  }

  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => {
      setLeaving(false);
      setPanel('confirm');
    }, PANEL_EXIT_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [leaving]);

  const slot = slots.data ? findSlot(slots.data, slotStart) : null;
  const pickTimeHref = (start: string | null) =>
    `/book?tz=${encodeURIComponent(zone)}${start ? `&date=${localDateOf(start, zone)}&slot=${encodeURIComponent(start)}` : ''}`;
  const choose = (next: Slot) => {
    setSearchParams(
      (params) => {
        params.set('slot', next.start);
        params.set('tz', zone);
        return params;
      },
      { replace: true },
    );
  };

  const steps = status === 'authenticated' ? 'confirm' : 'account';
  const changeTime = (
    <Link to={pickTimeHref(slotStart)} className={textLinkClassName}>
      Change time
    </Link>
  );

  let body;
  if (!slotStart) {
    body = (
      <Notice
        tone="caution"
        action={
          <Link
            to={pickTimeHref(null)}
            className={buttonVariants({ variant: 'secondary', size: 'compact' })}
          >
            Pick a time
          </Link>
        }
      >
        Choose a time first, then confirm it here.
      </Notice>
    );
  } else if (slots.isPending || status === 'unknown') {
    body = (
      <div
        aria-busy="true"
        aria-label="Checking the time is still free"
        className="flex flex-col gap-3"
      >
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-2/3" />
      </div>
    );
  } else if (slots.isError) {
    body = (
      <Notice
        tone="danger"
        role="alert"
        action={
          <Button size="compact" variant="secondary" onClick={() => void slots.refetch()}>
            Try again
          </Button>
        }
      >
        We couldn&apos;t check that this time is still free.
      </Notice>
    );
  } else if (!slot) {
    const alternatives = nearestFree(slots.data, slotStart);
    body = (
      <section role="status" className="flex flex-col gap-4 rounded-surface bg-sunken px-5 py-6">
        <h2 className="text-h3 text-ink">
          {alternatives.length > 0
            ? 'That time was just booked by another family. These times are still free:'
            : 'That time was just booked by another family.'}
        </h2>
        <div className="flex flex-col gap-2 sm:max-w-sm">
          {alternatives.map((alternative) => (
            <Button
              key={alternative.start}
              variant="secondary"
              className="justify-start tabular-nums"
              onClick={() => {
                choose(alternative);
              }}
            >
              {formatDateTime(alternative.start, zone, locale)}
            </Button>
          ))}
        </div>
        <Link to={pickTimeHref(null)} className={textLinkClassName}>
          See all times
        </Link>
      </section>
    );
  } else if (panel === 'account') {
    body = (
      <div data-leaving={leaving || undefined} className="motion-panel-out">
        <Suspense fallback={<Skeleton radius="surface" className="h-96 w-full max-w-form" />}>
          <AccountPanel returnTo={`${location.pathname}${location.search}`} />
        </Suspense>
      </div>
    );
  } else {
    body = (
      <div className="motion-panel-in">
        <ConfirmPanel slot={slot} onChangeSlot={choose} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-content px-4 pt-6 pb-16 sm:pt-10">
      <Stepper steps={BOOKING_STEPS} currentId={steps} />
      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <PageTitle>
            {status === 'authenticated' ? 'Confirm your trial' : 'Almost there'}
          </PageTitle>
          {slot && (
            <p className="rounded-control bg-sunken px-4 py-3 text-small text-ink tabular-nums lg:hidden">
              {formatDateTime(slot.start, zone, locale)} {zoneParts(zone, slot.start).name}.{' '}
              {changeTime}
            </p>
          )}
          {body}
        </div>
        <aside aria-label="Your trial" className="hidden lg:block">
          <div className="sticky top-24">
            <TimeTraySummary
              slot={slot}
              zone={zone}
              locale={locale}
              footer={slot ? changeTime : undefined}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
