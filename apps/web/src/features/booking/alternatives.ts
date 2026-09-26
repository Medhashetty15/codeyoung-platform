import type { Slot, SlotsResponse } from '@app/contracts';
import { compareInstants, minutesBetween } from '@app/time';

/** Up to `count` free slots closest in time to the one that was lost, earliest first. */
export function nearestFree(response: SlotsResponse, start: string, count = 3): Slot[] {
  const distance = (slot: Slot) => Math.abs(minutesBetween(start, slot.start));
  return response.days
    .flatMap((day) => day.slots)
    .filter((slot) => slot.start !== start)
    .sort((a, b) => distance(a) - distance(b))
    .slice(0, count)
    .sort((a, b) => compareInstants(a.start, b.start));
}
