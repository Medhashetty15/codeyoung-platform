import type { Slot, SlotsResponse } from '@app/contracts';
import { localHour } from '@app/time';

/**
 * Local hours the landing page prefers (start from 07:00, before 21:00). Mentor windows are IST
 * evenings, which land in the small hours for US families; a first impression of "4:00 AM" reads
 * as "not for us", so the hero leads with times a child could actually attend. Pick a time still
 * lists every slot, night ones included.
 */
export const FAMILY_HOURS = { from: 7, until: 21 } as const;

/**
 * The first `count` bookable times across the window, soonest first, preferring family hours in
 * `zone`. With no family-hour time in the window it falls back to the plain next times.
 */
export function nextFreeTimes(response: SlotsResponse, count: number, zone: string): Slot[] {
  const all = response.days.flatMap((day) => day.slots);
  const family = all.filter((slot) => {
    const hour = localHour(slot.start, zone);
    return hour >= FAMILY_HOURS.from && hour < FAMILY_HOURS.until;
  });
  return (family.length > 0 ? family : all).slice(0, count);
}
