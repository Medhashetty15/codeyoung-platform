import type { Slot, SlotDay } from '@app/contracts';
import { formatLocalDate } from '@app/time';

import { Button } from '../../shared/ui/Button';
import { CalendarBlankIcon } from '../../shared/ui/icons';

import { nextFreeLabel } from './slot-logic';

interface DayNoticeProps {
  day: SlotDay;
  next: Slot | null;
  zone: string;
  locale: string;
  onJump: (slot: Slot) => void;
}

/** A day with no times explains why and offers the next free time (doc 05 §5.1, doc 07 §9). */
export function DayNotice({ day, next, zone, locale, onJump }: DayNoticeProps) {
  const date = formatLocalDate(day.date, 'long', locale);
  const message =
    day.status === 'FULLY_BOOKED'
      ? `Every mentor is booked on ${date}.`
      : `There are no trial classes on ${date}.`;
  return (
    <div
      role="status"
      className="flex flex-col items-start gap-3 rounded-surface bg-sunken px-5 py-6"
    >
      <CalendarBlankIcon aria-hidden size={32} className="text-ink-muted" />
      <p className="text-h3 text-ink">{message}</p>
      {next && (
        <Button
          variant="secondary"
          onClick={() => {
            onJump(next);
          }}
        >
          {nextFreeLabel(next, zone, locale)}
        </Button>
      )}
    </div>
  );
}
