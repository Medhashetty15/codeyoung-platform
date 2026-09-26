import { type BookingNotModifiableReason, type BookingStatus, ErrorCode } from '@app/contracts';
import { isBefore, type Temporal } from '@app/time';

export interface SlotRules {
  gridMinutes: number;
  leadMinutes: number;
  horizonDays: number;
}

export type SlotProblem =
  | typeof ErrorCode.SLOT_NOT_ON_GRID
  | typeof ErrorCode.SLOT_IN_PAST
  | typeof ErrorCode.SLOT_OUTSIDE_HORIZON;

/**
 * Whether a requested start can be booked at all (E-9): on the UTC grid, at
 * least the lead time ahead, and before the horizon. Null when it can.
 */
export function slotProblem(
  start: Temporal.Instant,
  now: Temporal.Instant,
  rules: SlotRules,
): SlotProblem | null {
  if (start.epochMilliseconds % (rules.gridMinutes * 60_000) !== 0)
    return ErrorCode.SLOT_NOT_ON_GRID;
  if (isBefore(start, now.add({ minutes: rules.leadMinutes }))) return ErrorCode.SLOT_IN_PAST;
  if (!isBefore(start, now.add({ hours: 24 * rules.horizonDays })))
    return ErrorCode.SLOT_OUTSIDE_HORIZON;
  return null;
}

export interface BookingState {
  status: BookingStatus;
  startsAt: Temporal.Instant;
}

/** Parents cancel any confirmed class that has not started (FR-B8). */
export function cancelProblem(
  booking: BookingState,
  now: Temporal.Instant,
): BookingNotModifiableReason | null {
  if (booking.status !== 'CONFIRMED') return 'NOT_CONFIRMED';
  return isBefore(now, booking.startsAt) ? null : 'ALREADY_STARTED';
}

/** Parents reschedule until the cutoff before the start (FR-B9). */
export function rescheduleProblem(
  booking: BookingState,
  now: Temporal.Instant,
  cutoffMinutes: number,
): BookingNotModifiableReason | null {
  const cancel = cancelProblem(booking, now);
  if (cancel !== null) return cancel;
  return isBefore(now, booking.startsAt.subtract({ minutes: cutoffMinutes }))
    ? null
    : 'PAST_RESCHEDULE_CUTOFF';
}
