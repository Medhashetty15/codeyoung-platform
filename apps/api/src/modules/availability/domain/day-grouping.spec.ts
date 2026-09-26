import { describe, expect, it } from 'vitest';

import { Temporal } from '@app/time';

import { groupByLocalDate } from './day-grouping';

const at = (iso: string) => Temporal.Instant.from(iso);

describe('groupByLocalDate', () => {
  const base = {
    dates: ['2026-10-24', '2026-10-25', '2026-10-26'],
    durationMinutes: 60,
    transitions: [],
  };

  it('groups by the requester date: 20:00Z is Saturday in New York, Sunday in India', () => {
    const free = [at('2026-10-24T20:00:00Z')];

    const newYork = groupByLocalDate({
      ...base,
      timezone: 'America/New_York',
      free,
      scheduled: free,
    });
    const kolkata = groupByLocalDate({ ...base, timezone: 'Asia/Kolkata', free, scheduled: free });

    expect(newYork[0]?.slots).toEqual([
      { start: '2026-10-24T20:00:00Z', end: '2026-10-24T21:00:00Z' },
    ]);
    expect(kolkata[1]?.slots).toHaveLength(1);
    expect(kolkata[0]?.slots).toHaveLength(0);
  });

  it('tells available, fully booked and empty days apart', () => {
    const days = groupByLocalDate({
      ...base,
      timezone: 'UTC',
      free: [at('2026-10-24T16:00:00Z')],
      scheduled: [at('2026-10-24T16:00:00Z'), at('2026-10-25T16:00:00Z')],
    });

    expect(days.map((day) => day.status)).toEqual(['AVAILABLE', 'FULLY_BOOKED', 'NO_AVAILABILITY']);
  });

  it('lists every requested date and puts DST changes on their day', () => {
    const days = groupByLocalDate({
      ...base,
      timezone: 'Europe/London',
      free: [],
      scheduled: [],
      transitions: [{ at: '2026-10-25T01:00:00Z', offsetBefore: '+01:00', offsetAfter: '+00:00' }],
    });

    expect(days.map((day) => day.date)).toEqual(base.dates);
    expect(days[1]?.dstTransition).toEqual({
      at: '2026-10-25T01:00:00Z',
      offsetBefore: '+01:00',
      offsetAfter: '+00:00',
    });
    expect(days[0]).not.toHaveProperty('dstTransition');
  });
});
