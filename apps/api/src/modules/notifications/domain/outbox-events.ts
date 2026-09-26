/** Outbox message types and their payloads (docs/03 §3.3, §7). */
export interface OutboxEvents {
  /** Carries the raw reset token for the email link; scrubbed once delivered (docs/03 §7.2). */
  PasswordResetRequested: { userId: string; token: string; expiresAt: string };
  PasswordChanged: { userId: string; reason: 'CHANGED' | 'RESET' };
  BookingConfirmed: { bookingId: string };
  /** Skipped at send time unless the booking is still confirmed at `startsAt` (E-17). */
  BookingReminder: { bookingId: string; kind: '24h' | '1h'; startsAt: string };
  BookingCancelled: { bookingId: string };
  BookingRescheduled: { fromBookingId: string; toBookingId: string };
}

export type OutboxEventType = keyof OutboxEvents;
