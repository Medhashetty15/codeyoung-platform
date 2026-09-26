import type { ReactNode } from 'react';

import type { Slot } from '@app/contracts';
import { formatDate, formatTime, formatTimeRange, minutesBetween, zoneParts } from '@app/time';

import { Button } from '../../shared/ui/Button';
import { TimeTray } from '../../shared/ui/TimeTray';

interface TimeTraySummaryProps {
  slot: Slot | null;
  zone: string;
  locale: string;
  /** Primary action under the details (Continue, Move trial); omit on the confirm page. */
  actionLabel?: string;
  onAction?: () => void;
  /** Above the time, e.g. the reschedule "Moving from" line. */
  children?: ReactNode;
  /** Under the details, e.g. a "Change time" link. */
  footer?: ReactNode;
}

/** The booking summary in the Time Tray (doc 05 §5.1, doc 07 §4 signature element). */
export function TimeTraySummary({
  slot,
  zone,
  locale,
  actionLabel,
  onAction,
  children,
  footer,
}: TimeTraySummaryProps) {
  if (!slot) {
    return (
      <TimeTray>
        {children}
        <p className="text-body text-ink-muted">Choose a time to see it here.</p>
      </TimeTray>
    );
  }
  const minutes = minutesBetween(slot.start, slot.end);
  return (
    <TimeTray>
      {children}
      <p className="text-h3 text-ink">{formatDate(slot.start, zone, 'long', locale)}</p>
      <p className="mt-1 text-time-xl text-ink tabular-nums">
        <time dateTime={slot.start}>{formatTime(slot.start, zone, locale)}</time>
      </p>
      <p className="mt-2 text-small text-ink-muted tabular-nums">
        {formatTimeRange(slot.start, slot.end, zone, locale)} {zoneParts(zone, slot.start).name}
      </p>
      <p className="text-small text-ink-muted">{String(minutes)} min live class, free</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-5 w-full">
          {actionLabel}
        </Button>
      )}
      {Boolean(footer) && <div className="mt-4">{footer}</div>}
    </TimeTray>
  );
}
