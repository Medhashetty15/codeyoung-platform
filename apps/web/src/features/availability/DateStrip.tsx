import { useEffect, useRef } from 'react';

import type { SlotDay } from '@app/contracts';
import { formatLocalDate, type LocalDate } from '@app/time';

import { useKeyboardModality } from '../../shared/hooks/useKeyboardModality';
import { ChoiceGroup } from '../../shared/ui/ChoiceGroup';
import { DateChip } from '../../shared/ui/DateChip';

import { availabilityLabel, dayAccessibleName } from './slot-logic';

interface DateStripProps {
  days: SlotDay[];
  value: LocalDate;
  locale: string;
  onChange: (date: LocalDate, via: 'keyboard' | 'pointer') => void;
}

/**
 * The 14 days in the parent's zone (doc 05 §5.1): one tab stop, arrow keys inside, native
 * horizontal scroll with snap. Unavailable days stay selectable so they can say why.
 */
export function DateStrip({ days, value, locale, onChange }: DateStripProps) {
  const modality = useKeyboardModality();
  const stripRef = useRef<HTMLDivElement>(null);

  // Keep the chosen day in view, e.g. after "Next free time" jumps a week ahead.
  useEffect(() => {
    stripRef.current
      ?.querySelector('input:checked')
      ?.closest('label')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [value]);

  return (
    <div
      ref={stripRef}
      {...modality.props}
      className="no-scrollbar -mx-4 snap-x snap-mandatory scroll-px-4 overflow-x-auto overscroll-x-contain px-4 pb-1"
    >
      <ChoiceGroup
        label="Day"
        value={value}
        onChange={(next) => {
          onChange(next, modality.viaKeyboard() ? 'keyboard' : 'pointer');
        }}
        className="flex w-max gap-2"
      >
        {days.map((day) => (
          <DateChip
            key={day.date}
            value={day.date}
            weekday={formatLocalDate(day.date, 'weekday', locale)}
            day={formatLocalDate(day.date, 'dayNumber', locale)}
            availability={availabilityLabel(day)}
            muted={day.slots.length === 0}
            label={dayAccessibleName(day, locale)}
          />
        ))}
      </ChoiceGroup>
    </div>
  );
}
