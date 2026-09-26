import type { ClassroomView } from '@app/contracts';
import { addMinutes, epochMs } from '@app/time';

export type ClassroomPhase = 'upcoming' | 'open' | 'ended' | 'cancelled' | 'moved';

/**
 * Milliseconds to add to this device's clock to match the server (doc 05 §7), from a response
 * received at `receivedAtMs` device time. Half the round trip is ignored: a second is plenty here.
 */
export function clockOffsetMs(serverTime: string, receivedAtMs: number): number {
  return epochMs(serverTime) - receivedAtMs;
}

/** When the classroom opens: `classroomOpensMinutesBefore` before the start. */
export function opensAt(
  view: Pick<ClassroomView, 'start' | 'classroomOpensMinutesBefore'>,
): number {
  return epochMs(addMinutes(view.start, -view.classroomOpensMinutesBefore));
}

/** Which classroom state to show at server time `nowMs` (doc 05 §7 table). */
export function classroomPhase(
  view: Pick<ClassroomView, 'status' | 'start' | 'end' | 'classroomOpensMinutesBefore'>,
  nowMs: number,
): ClassroomPhase {
  if (view.status === 'CANCELLED') return 'cancelled';
  if (view.status === 'RESCHEDULED') return 'moved';
  if (view.status === 'COMPLETED' || nowMs >= epochMs(view.end)) return 'ended';
  return nowMs >= opensAt(view) ? 'open' : 'upcoming';
}

/** "2 hours 5 minutes" for screen readers, announced once a minute rather than every second. */
export function countdownSentence(parts: { days: number; hours: number; minutes: number }): string {
  const unit = (value: number, one: string) =>
    value > 0 ? `${String(value)} ${one}${value === 1 ? '' : 's'}` : null;
  const words = [unit(parts.days, 'day'), unit(parts.hours, 'hour'), unit(parts.minutes, 'minute')]
    .filter(Boolean)
    .join(' ');
  return words || 'less than a minute';
}
