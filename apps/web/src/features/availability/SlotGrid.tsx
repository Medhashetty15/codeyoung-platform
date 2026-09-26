import { useId } from 'react';

import type { Slot } from '@app/contracts';
import { formatTime } from '@app/time';

import { ChoiceGroup } from '../../shared/ui/ChoiceGroup';
import { SlotChip } from '../../shared/ui/SlotChip';

import { groupByPartOfDay } from './slot-logic';

interface SlotGridProps {
  slots: Slot[];
  zone: string;
  locale: string;
  value: string | null;
  onChange: (start: string) => void;
  /** Reschedule: the booking's own time, shown as "Current" and not selectable. */
  currentStart?: string | undefined;
  /** Pointer-driven day changes fade the new grid in; keyboard-driven ones never animate (row 4b). */
  animate: boolean;
}

/** Times for one day grouped Morning / Afternoon / Evening, as one radio group (doc 05 §5.1). */
export function SlotGrid({
  slots,
  zone,
  locale,
  value,
  onChange,
  currentStart,
  animate,
}: SlotGridProps) {
  const labelId = useId();
  return (
    <ChoiceGroup
      labelledBy={labelId}
      value={value}
      onChange={onChange}
      className={animate ? 'motion-swap-in flex flex-col gap-6' : 'flex flex-col gap-6'}
    >
      <span id={labelId} className="sr-only">
        Time
      </span>
      {groupByPartOfDay(slots, zone).map((group) => (
        <div key={group.part} role="group" aria-label={group.part} className="flex flex-col gap-3">
          <h3 aria-hidden className="text-h3 text-ink">
            {group.part}
          </h3>
          <div className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {group.slots.map((slot) => (
              <SlotChip key={slot.start} value={slot.start} current={slot.start === currentStart}>
                {formatTime(slot.start, zone, locale)}
              </SlotChip>
            ))}
          </div>
        </div>
      ))}
    </ChoiceGroup>
  );
}
