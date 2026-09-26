import type { BookingSummary, CancelReason } from '@app/contracts';
import { addMinutes, epochMs } from '@app/time';

/**
 * "Join class" is the primary action only while the classroom is open: from
 * `classroomOpensMinutesBefore` before the start until the end (doc 05 §6.2).
 */
export function isClassWindowOpen(
  booking: Pick<BookingSummary, 'status' | 'start' | 'end'>,
  nowMs: number,
  opensMinutesBefore: number,
): boolean {
  if (booking.status !== 'CONFIRMED') return false;
  const opens = epochMs(addMinutes(booking.start, -opensMinutesBefore));
  return nowMs >= opens && nowMs < epochMs(booking.end);
}

/** The class link as an in-app path when it points at this site, so joining stays in the SPA. */
export function inAppPath(url: string, origin: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.origin === origin ? `${parsed.pathname}${parsed.search}` : null;
  } catch {
    return null;
  }
}

/** "2 hours", "90 minutes": the reschedule cutoff in words (doc 05 §6.3). */
export function durationPhrase(minutes: number): string {
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? '1 hour' : `${String(hours)} hours`;
  }
  return `${String(minutes)} minutes`;
}

/** Cancel reasons in the parent's words (PD-14). */
export const CANCEL_REASONS: { value: CancelReason; label: string }[] = [
  { value: 'SCHEDULE_CHANGED', label: 'Our plans changed' },
  { value: 'CHILD_UNAVAILABLE', label: 'My child can no longer make it' },
  { value: 'BOOKED_BY_MISTAKE', label: 'I booked by mistake' },
  { value: 'OTHER', label: 'Something else' },
];

/** Copy for 409 BOOKING_NOT_MODIFIABLE by its `reason` (doc 03 §9). */
export function notModifiableText(reason: unknown, cutoffMinutes: number): string {
  if (reason === 'ALREADY_STARTED')
    return 'This trial has already started, so it can no longer be changed.';
  if (reason === 'PAST_RESCHEDULE_CUTOFF') {
    return `Trials can be moved up to ${durationPhrase(cutoffMinutes)} before they start.`;
  }
  return 'This trial was already cancelled or moved.';
}
