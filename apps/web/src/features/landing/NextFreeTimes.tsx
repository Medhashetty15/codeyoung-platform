import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';

import { formatDate, formatTime, nowInstant, zoneLabel } from '@app/time';

import { Button } from '../../shared/ui/Button';
import { ArrowRightIcon } from '../../shared/ui/icons';
import { Skeleton } from '../../shared/ui/Skeleton';
import { textLinkClassName } from '../../shared/ui/text-link';
import { TimeTray } from '../../shared/ui/TimeTray';
import { bookingConfigQuery, slotsQuery } from '../availability/queries';
import { horizonPhrase } from '../availability/slot-logic';
import { useDisplayZone } from '../timezone';

import { nextFreeTimes } from './next-free-times';

const rowClassName =
  'pressable -mx-2 flex h-14 items-center justify-between gap-4 rounded-control px-2 hover:bg-sunken';

/**
 * The hero visual is the product itself (doc 05 §4, doc 07 §5): the next four free times in the
 * visitor's zone. A tap goes straight to Confirm with that time chosen.
 */
export function NextFreeTimes() {
  const { zone, locale } = useDisplayZone();
  const slots = useQuery(slotsQuery(zone));
  const config = useQuery(bookingConfigQuery());
  const times = slots.data ? nextFreeTimes(slots.data, 4) : [];
  const allTimes = `/book?tz=${encodeURIComponent(zone)}`;

  return (
    <TimeTray>
      <div className="flex flex-col gap-1">
        <h2 className="text-h3 font-bold text-ink">Next free times</h2>
        {/* The offset of the times shown, so it matches them across a clock change. */}
        <p className="text-small text-ink-muted">
          {zoneLabel(zone, times[0]?.start ?? nowInstant())}
        </p>
      </div>

      {slots.isPending && (
        <div aria-busy="true" aria-label="Loading free times" className="mt-4 flex flex-col gap-2">
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} className="h-12 w-full" />
          ))}
        </div>
      )}

      {slots.isError && (
        <div className="mt-4 flex flex-col items-start gap-3">
          <p className="text-body text-ink-muted">We couldn&apos;t load the free times.</p>
          <Button size="compact" variant="secondary" onClick={() => void slots.refetch()}>
            Try again
          </Button>
        </div>
      )}

      {slots.data && times.length === 0 && (
        <div className="mt-4 flex flex-col items-start gap-3">
          <p className="text-body text-ink">
            All trial classes for the next{' '}
            {horizonPhrase(config.data?.horizonDays ?? slots.data.days.length)} are taken
          </p>
          <Link to={allTimes} className={textLinkClassName}>
            Join the waitlist
          </Link>
        </div>
      )}

      {times.length > 0 && (
        <>
          <ul className="mt-3 flex flex-col">
            {times.map((slot) => (
              <li key={slot.start}>
                <Link
                  to={`/book/confirm?slot=${encodeURIComponent(slot.start)}&tz=${encodeURIComponent(zone)}`}
                  className={rowClassName}
                >
                  <span className="text-body text-ink-muted">
                    {formatDate(slot.start, zone, 'short', locale)}
                  </span>
                  <span className="text-h3 font-bold text-ink tabular-nums">
                    {formatTime(slot.start, zone, locale)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            to={allTimes}
            className="mt-3 inline-flex items-center gap-1.5 text-small font-medium text-accent hover:underline"
          >
            See all times
            <ArrowRightIcon aria-hidden size={16} />
          </Link>
        </>
      )}
    </TimeTray>
  );
}
