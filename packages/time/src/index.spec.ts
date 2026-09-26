import { describe, expect, it } from 'vitest';

import { Temporal } from './index.js';

describe('@app/time', () => {
  it('exposes a working Temporal implementation', () => {
    const instant = Temporal.Instant.from('2026-10-24T20:00:00Z');

    expect(instant.toZonedDateTimeISO('Asia/Kolkata').toPlainDate().toString()).toBe('2026-10-25');
  });
});
