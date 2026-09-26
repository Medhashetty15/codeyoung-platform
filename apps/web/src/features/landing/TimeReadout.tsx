import { useQuery } from '@tanstack/react-query';

import { formatDate, formatTime, zoneParts } from '@app/time';

import { Skeleton } from '../../shared/ui/Skeleton';
import { bookingConfigQuery, slotsQuery } from '../availability/queries';
import { useDisplayZone } from '../timezone';

import { nextFreeTimes } from './next-free-times';

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-small text-ink-muted">{label}</span>
      <span className="text-time-xl text-ink tabular-nums">{value}</span>
    </div>
  );
}

/**
 * "Your class" and "Your mentor" for the next free time, computed live for this visitor's zone
 * and the mentors' zone from booking-config (doc 05 §4, section 3).
 */
export function TimeReadout() {
  const { zone, locale } = useDisplayZone();
  const slots = useQuery(slotsQuery(zone));
  const config = useQuery(bookingConfigQuery());
  const next = slots.data ? nextFreeTimes(slots.data, 1)[0] : undefined;
  const mentorZone = config.data?.mentorTimezone;

  if (slots.isPending || config.isPending) {
    return (
      <div aria-hidden className="flex flex-col gap-6 sm:flex-row sm:items-end sm:gap-10">
        <Skeleton className="h-16 w-64" />
        <Skeleton className="h-16 w-64" />
      </div>
    );
  }
  // Without a free time or the mentors' zone there is nothing true to show; the sentence stands alone.
  if (!next || !mentorZone) return null;

  const at = (target: string) =>
    `${formatDate(next.start, target, 'weekday', locale)} ${formatTime(next.start, target, locale)} ${zoneParts(target, next.start).name}`;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
      <Readout label="Your class" value={at(zone)} />
      <span
        aria-hidden
        className="ml-3 h-8 w-px bg-line-control sm:mb-4 sm:ml-0 sm:h-px sm:w-auto sm:min-w-12 sm:flex-1"
      />
      <Readout label="Your mentor" value={at(mentorZone)} />
    </div>
  );
}
