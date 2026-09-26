import type { ReactNode } from 'react';

import type { Slot } from '@app/contracts';
import { compareInstants, localDateOf } from '@app/time';

import { Button } from '../../shared/ui/Button';
import { Notice } from '../../shared/ui/Notice';
import { DstNotice } from '../timezone';

import { DateStrip } from './DateStrip';
import { DayNotice } from './DayNotice';
import { firstTransition, isWindowEmpty, nextFreeAfter } from './slot-logic';
import { SlotGrid } from './SlotGrid';
import { SlotsSkeleton } from './SlotsSkeleton';
import type { PickTime } from './usePickTime';

/** The day's times, with the booking's own time shown in place when rescheduling. */
function withCurrent(slots: Slot[], current: Slot | undefined, zone: string, date: string): Slot[] {
  if (!current || localDateOf(current.start, zone) !== date) return slots;
  if (slots.some((slot) => slot.start === current.start)) return slots;
  return [...slots, current].sort((a, b) => compareInstants(a.start, b.start));
}

/**
 * Date strip and slot grid with their loading, error and empty states (doc 05 §5.1). Shared by
 * Pick a time and Reschedule; the page owns the heading and the tray.
 */
export function SlotPicker({ picker, empty }: { picker: PickTime; empty: ReactNode }) {
  const { slots, zone, locale, date, day, selected, current, animateGrid } = picker;
  const data = slots.data;
  const transition = data ? firstTransition(data) : null;
  const daySlots = day && date ? withCurrent(day.slots, current, zone, date) : [];

  return (
    <>
      {transition && <DstNotice transition={transition} />}

      {slots.isPending && <SlotsSkeleton />}

      {slots.isError && (
        <Notice
          tone="danger"
          role="alert"
          action={
            <Button size="compact" variant="secondary" onClick={() => void slots.refetch()}>
              Try again
            </Button>
          }
        >
          We couldn&apos;t load available times.
        </Notice>
      )}

      {data && isWindowEmpty(data) && empty}

      {data && !isWindowEmpty(data) && date && day && (
        // Row 5: the loaded strip and grid fade in once where the skeleton was.
        <div className="motion-fade-in flex flex-col gap-6">
          <DateStrip
            days={data.days}
            value={date}
            locale={locale}
            onChange={(nextDate, via) => {
              picker.setAnimateGrid(via === 'pointer');
              picker.update({ date: nextDate });
            }}
          />
          <div key={date}>
            {daySlots.length > 0 ? (
              <SlotGrid
                slots={daySlots}
                zone={zone}
                locale={locale}
                value={selected?.start ?? null}
                currentStart={current?.start}
                animate={animateGrid}
                onChange={(start) => {
                  const slot = daySlots.find((candidate) => candidate.start === start);
                  if (slot) picker.choose(slot);
                }}
              />
            ) : (
              <DayNotice
                day={day}
                next={nextFreeAfter(data, date)}
                zone={zone}
                locale={locale}
                onJump={(slot) => {
                  picker.setAnimateGrid(false);
                  picker.choose(slot);
                }}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
