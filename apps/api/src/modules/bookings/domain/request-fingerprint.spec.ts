import { describe, expect, it } from 'vitest';

import { requestFingerprint } from './request-fingerprint';

const base = { action: 'create', slotStart: '2026-10-24T16:00:00Z', timezone: 'Europe/London' };

describe('requestFingerprint', () => {
  it('is stable for the same request and ignores name case', () => {
    expect(requestFingerprint({ ...base, student: { firstName: 'Leo', age: 9 } })).toBe(
      requestFingerprint({ ...base, student: { firstName: 'leo', age: 9 } }),
    );
  });

  it('changes with the slot, zone, student or action', () => {
    const reference = requestFingerprint({ ...base, student: { id: 'a' } });

    expect(
      requestFingerprint({ ...base, slotStart: '2026-10-24T16:30:00Z', student: { id: 'a' } }),
    ).not.toBe(reference);
    expect(requestFingerprint({ ...base, timezone: 'UTC', student: { id: 'a' } })).not.toBe(
      reference,
    );
    expect(requestFingerprint({ ...base, student: { id: 'b' } })).not.toBe(reference);
    expect(requestFingerprint({ ...base, action: 'reschedule:x', student: { id: 'a' } })).not.toBe(
      reference,
    );
  });
});
