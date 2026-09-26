import type { Slot, SlotDay, SlotsResponse } from '@app/contracts';
import { formatDateTime, formatLocalDate, localDateOf, localHour, type LocalDate } from '@app/time';

export type PartOfDay = 'Night' | 'Morning' | 'Afternoon' | 'Evening';

/**
 * Slot groups by the parent's local hour (doc 05 §5.1): Morning 06 to 12, Afternoon 12 to 17,
 * Evening from 17. Mentor windows are Indian evenings, so a few slots land after midnight for
 * parents; those read "Night" rather than a misleading "Morning".
 */
export function groupByPartOfDay(
  slots: Slot[],
  zone: string,
): { part: PartOfDay; slots: Slot[] }[] {
  const part = (slot: Slot): PartOfDay => {
    const hour = localHour(slot.start, zone);
    if (hour < 6) return 'Night';
    if (hour < 12) return 'Morning';
    return hour < 17 ? 'Afternoon' : 'Evening';
  };
  return (['Night', 'Morning', 'Afternoon', 'Evening'] as const)
    .map((name) => ({ part: name, slots: slots.filter((slot) => part(slot) === name) }))
    .filter((group) => group.slots.length > 0);
}

/** The short line under a date chip: "4 times", "1 time", "Full", "No classes". */
export function availabilityLabel(day: SlotDay): string {
  if (day.status === 'FULLY_BOOKED') return 'Full';
  if (day.status === 'NO_AVAILABILITY' || day.slots.length === 0) return 'No classes';
  return day.slots.length === 1 ? '1 time' : `${String(day.slots.length)} times`;
}

/** Full accessible name for a date chip, e.g. "Saturday 24 October, 4 times available". */
export function dayAccessibleName(day: SlotDay, locale: string): string {
  const date = formatLocalDate(day.date, 'long', locale);
  if (day.status === 'FULLY_BOOKED') return `${date}, fully booked`;
  if (day.status === 'NO_AVAILABILITY' || day.slots.length === 0) return `${date}, no classes`;
  const count = day.slots.length;
  return `${date}, ${String(count)} ${count === 1 ? 'time' : 'times'} available`;
}

/** Initial day: the requested one when it is in the window, else the first day with times. */
export function defaultDate(days: SlotDay[], requested: LocalDate | null): LocalDate | null {
  if (requested && days.some((day) => day.date === requested)) return requested;
  return (days.find((day) => day.slots.length > 0) ?? days[0])?.date ?? null;
}

/** The first free slot after the given day in this window, else the horizon's next free slot. */
export function nextFreeAfter(response: SlotsResponse, date: LocalDate): Slot | null {
  for (const day of response.days) {
    if (day.date > date && day.slots.length > 0) return day.slots[0] ?? null;
  }
  const next = response.nextAvailable;
  return next && localDateOf(next.start, response.timezone) !== date ? next : null;
}

/** Nothing bookable in the whole horizon: show the waitlist (doc 05 §5.1, E-16). */
export function isWindowEmpty(response: SlotsResponse): boolean {
  return response.nextAvailable === null && response.days.every((day) => day.slots.length === 0);
}

export function findSlot(response: SlotsResponse, start: string | null): Slot | null {
  if (!start) return null;
  for (const day of response.days) {
    const slot = day.slots.find((candidate) => candidate.start === start);
    if (slot) return slot;
  }
  return null;
}

/** First clock change on the dates on screen, for the DST notice. */
export function firstTransition(response: SlotsResponse) {
  return response.days.find((day) => day.dstTransition)?.dstTransition ?? null;
}

/** "Next free time: Tue 27 Oct, 5:00 PM" (doc 07 §9). */
export function nextFreeLabel(slot: Slot, zone: string, locale: string): string {
  return `Next free time: ${formatDateTime(slot.start, zone, locale)}`;
}
