import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

import type { Slot } from '@app/contracts';
import { localDateOf, type LocalDate } from '@app/time';

import { notify } from '../../shared/ui/notify';
import { useDisplayZone } from '../timezone';

import { slotsQuery } from './queries';
import { defaultDate, findSlot } from './slot-logic';
import { parseBookSearch } from './url-state';

interface PickTimeOptions {
  /** Reschedule: the booking's own time. It opens on that day and can never be the selection. */
  current?: Slot | undefined;
  /** Runs after a time is chosen, e.g. to warm the next page's chunk. */
  onChoose?: (slot: Slot) => void;
}

/**
 * State for a Pick a time screen (doc 05 §5.1, §6.4): the day and time live in the URL
 * (`?tz=&date=&slot=`, ADR 0013), the slots come from the API in the display zone.
 */
export function usePickTime({ current, onChoose }: PickTimeOptions = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = parseBookSearch(searchParams);
  const { zone, locale } = useDisplayZone();
  const slots = useQuery(slotsQuery(zone));
  const [animateGrid, setAnimateGrid] = useState(false);

  const data = slots.data;
  const found = data ? findSlot(data, search.slot) : null;
  const selected = found && found.start !== current?.start ? found : null;
  const opening = search.slot ?? current?.start ?? null;
  const date: LocalDate | null = data
    ? defaultDate(data.days, search.date ?? (opening ? localDateOf(opening, zone) : null))
    : null;
  const day = data?.days.find((candidate) => candidate.date === date);

  const update = (next: { date?: LocalDate | null; slot?: string | null }) => {
    setSearchParams(
      (params) => {
        params.set('tz', zone);
        for (const [key, value] of Object.entries(next)) {
          if (value) params.set(key, value);
          else params.delete(key);
        }
        return params;
      },
      { replace: true },
    );
  };

  // The chosen time vanished on a refetch or never existed on a shared link (doc 05 §5.1).
  const vanished = Boolean(data && search.slot && !found);
  useEffect(() => {
    if (!vanished) return;
    notify('That time was just booked. Please choose another.', { id: 'slot-vanished' });
    setSearchParams(
      (params) => {
        params.delete('slot');
        return params;
      },
      { replace: true },
    );
  }, [vanished, setSearchParams]);

  const choose = (slot: Slot) => {
    update({ date: localDateOf(slot.start, zone), slot: slot.start });
    onChoose?.(slot);
  };

  return {
    zone,
    locale,
    slots,
    selected,
    date,
    day,
    current,
    animateGrid,
    setAnimateGrid,
    update,
    choose,
  };
}

export type PickTime = ReturnType<typeof usePickTime>;
