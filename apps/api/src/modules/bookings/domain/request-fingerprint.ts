import { createHash } from 'node:crypto';

import { type BookingStudent } from '@app/contracts';

export interface FingerprintedRequest {
  /** What the request is for: `create` or `reschedule:<booking id>`. */
  action: string;
  slotStart: string;
  timezone: string;
  student?: BookingStudent;
}

/**
 * sha256 of the canonical request, stored with the Idempotency-Key: a replay
 * with the same key must carry the same request (E-2).
 */
export function requestFingerprint(request: FingerprintedRequest): string {
  const student =
    request.student === undefined
      ? null
      : 'id' in request.student
        ? { id: request.student.id }
        : { firstName: request.student.firstName.toLowerCase(), age: request.student.age };
  const canonical = JSON.stringify([request.action, request.slotStart, request.timezone, student]);
  return createHash('sha256').update(canonical).digest('hex');
}
