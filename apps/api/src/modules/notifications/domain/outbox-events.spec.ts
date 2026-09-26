import { describe, expect, it } from 'vitest';

import { isOutboxEventType, scrubPayload } from './outbox-events';

describe('scrubPayload', () => {
  it('removes the reset token and keeps the rest', () => {
    expect(
      scrubPayload('PasswordResetRequested', {
        userId: 'u1',
        token: 'secret',
        expiresAt: '2026-10-20T09:30:00Z',
      }),
    ).toEqual({ userId: 'u1', expiresAt: '2026-10-20T09:30:00Z' });
  });

  it('leaves payloads without secrets untouched', () => {
    const payload = { bookingId: 'b1' };

    expect(scrubPayload('BookingConfirmed', payload)).toBe(payload);
    expect(scrubPayload('SomethingElse', payload)).toBe(payload);
  });
});

describe('isOutboxEventType', () => {
  it('knows the handled types only', () => {
    expect(isOutboxEventType('BookingReminder')).toBe(true);
    expect(isOutboxEventType('toString')).toBe(false);
  });
});
