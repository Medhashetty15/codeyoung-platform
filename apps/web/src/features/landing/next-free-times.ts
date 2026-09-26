import type { Slot, SlotsResponse } from '@app/contracts';

/** The first `count` bookable times across the whole window, soonest first. */
export function nextFreeTimes(response: SlotsResponse, count: number): Slot[] {
  return response.days.flatMap((day) => day.slots).slice(0, count);
}
