/** Outbox message types and their payloads (docs/03 §3.3, §7). */
export interface OutboxEvents {
  /** Carries the raw reset token for the email link; scrubbed once handled (docs/03 §7.2). */
  PasswordResetRequested: { userId: string; token: string; expiresAt: string };
  PasswordChanged: { userId: string; reason: 'CHANGED' | 'RESET' };
  BookingConfirmed: { bookingId: string };
  /** Skipped at send time unless the booking is still confirmed at `startsAt` (E-17). */
  BookingReminder: { bookingId: string; kind: '24h' | '1h'; startsAt: string };
  BookingCancelled: { bookingId: string };
  BookingRescheduled: { fromBookingId: string; toBookingId: string };
  /** Ops moved the booking to another mentor; the previous one gets a cancellation. */
  BookingReassigned: { bookingId: string; previousMentorId: string };
}

export type OutboxEventType = keyof OutboxEvents;

export const OUTBOX_EVENT_TYPES: readonly OutboxEventType[] = [
  'PasswordResetRequested',
  'PasswordChanged',
  'BookingConfirmed',
  'BookingReminder',
  'BookingCancelled',
  'BookingRescheduled',
  'BookingReassigned',
];

export function isOutboxEventType(type: string): type is OutboxEventType {
  return (OUTBOX_EVENT_TYPES as readonly string[]).includes(type);
}

/** Payload fields that are secrets and must not outlive the message (ADR 0005). */
const SENSITIVE_FIELDS: Partial<Record<OutboxEventType, readonly string[]>> = {
  PasswordResetRequested: ['token'],
};

/** The payload as stored once the message is finished: secrets removed. */
export function scrubPayload(
  type: string,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const fields = isOutboxEventType(type) ? SENSITIVE_FIELDS[type] : undefined;
  if (fields === undefined) return payload;
  return Object.fromEntries(Object.entries(payload).filter(([key]) => !fields.includes(key)));
}
