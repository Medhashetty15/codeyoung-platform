import { describe, expect, it } from 'vitest';

import { buildSlotsResponse } from '@app/contracts/testing';
import { localHour } from '@app/time';

import { FAMILY_HOURS, nextFreeTimes } from './next-free-times';

const slot = (start: string) => ({
  start,
  end: start.replace(/T(\d\d)/, (_, h: string) => `T${String(Number(h) + 1).padStart(2, '0')}`),
});

function response(starts: string[]) {
  const base = buildSlotsResponse();
  return {
    ...base,
    days: [{ date: '2026-10-24' as const, status: 'AVAILABLE' as const, slots: starts.map(slot) }],
  };
}

describe('nextFreeTimes', () => {
  it('leads with times a New York family can attend, skipping the small hours', () => {
    // 08:00Z and 08:30Z are 04:00 and 04:30 in New York; 13:00Z onwards is 09:00 and later.
    const times = nextFreeTimes(
      response([
        '2026-10-24T08:00:00Z',
        '2026-10-24T08:30:00Z',
        '2026-10-24T13:00:00Z',
        '2026-10-24T13:30:00Z',
      ]),
      4,
      'America/New_York',
    );
    expect(times.map((t) => t.start)).toEqual(['2026-10-24T13:00:00Z', '2026-10-24T13:30:00Z']);
    for (const t of times) {
      expect(localHour(t.start, 'America/New_York')).toBeGreaterThanOrEqual(FAMILY_HOURS.from);
      expect(localHour(t.start, 'America/New_York')).toBeLessThan(FAMILY_HOURS.until);
    }
  });

  it('falls back to the plain next times when only night times exist', () => {
    const night = ['2026-10-24T06:00:00Z', '2026-10-24T06:30:00Z', '2026-10-24T07:00:00Z'];
    expect(nextFreeTimes(response(night), 4, 'America/New_York').map((t) => t.start)).toEqual(
      night,
    );
  });

  it("keeps a London family's evening times as they are", () => {
    const evening = ['2026-10-24T16:00:00Z', '2026-10-24T16:30:00Z'];
    expect(nextFreeTimes(response(evening), 4, 'Europe/London').map((t) => t.start)).toEqual(
      evening,
    );
  });
});
