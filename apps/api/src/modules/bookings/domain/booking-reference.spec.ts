import { describe, expect, it } from 'vitest';

import { BookingReferenceSchema } from '@app/contracts';

import { newBookingReference } from './booking-reference';

describe('newBookingReference', () => {
  it('produces contract-valid Crockford references', () => {
    const references = Array.from({ length: 500 }, () => newBookingReference());

    for (const reference of references)
      expect(BookingReferenceSchema.parse(reference)).toBe(reference);
    expect(new Set(references).size).toBeGreaterThan(495);
  });
});
