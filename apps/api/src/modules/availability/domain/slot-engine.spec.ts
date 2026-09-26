import { describe, expect, it } from 'vitest';

import { isoInstant, Temporal } from '@app/time';

import {
  type AvailabilityRule,
  computeSlots,
  type MentorSchedule,
  type SlotEngineConfig,
} from './slot-engine';

const CONFIG: SlotEngineConfig = {
  durationMinutes: 60,
  gridMinutes: 30,
  bufferMinutes: 15,
  leadMinutes: 240,
  horizonDays: 14,
};

const at = (iso: string) => Temporal.Instant.from(iso);
const NOW = at('2026-10-20T00:00:00Z');

/** A rule for every weekday, effective all year. */
function daily(startLocal: string, endLocal: string): AvailabilityRule[] {
  return [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
    weekday,
    startLocal,
    endLocal,
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
  }));
}

function mentor(overrides: Partial<MentorSchedule> = {}): MentorSchedule {
  return {
    id: 'priya',
    timezone: 'Asia/Kolkata',
    maxTrialsPerDay: 2,
    rules: daily('19:00', '23:00'),
    timeOff: [],
    bookings: [],
    ...overrides,
  };
}

function starts(
  mentors: MentorSchedule[],
  from = '2026-10-24T00:00:00Z',
  to = '2026-10-25T00:00:00Z',
  config = CONFIG,
  now = NOW,
) {
  const result = computeSlots({ from: at(from), to: at(to), now }, config, mentors);
  return {
    free: result.free.map((slot) => isoInstant(slot.start)),
    freeWithMentors: result.free.map((slot) => [isoInstant(slot.start), slot.mentorIds]),
    scheduled: result.scheduled.map((start) => isoInstant(start)),
  };
}

describe('computeSlots: availability windows', () => {
  it('fits class plus buffer inside the window on the 30-minute UTC grid', () => {
    // 19:00 to 23:00 IST = 13:30Z to 17:30Z; the last start must end its buffer by 17:30Z.
    expect(starts([mentor()]).free).toEqual([
      '2026-10-24T13:30:00Z',
      '2026-10-24T14:00:00Z',
      '2026-10-24T14:30:00Z',
      '2026-10-24T15:00:00Z',
      '2026-10-24T15:30:00Z',
      '2026-10-24T16:00:00Z',
    ]);
  });

  it('aligns off-grid windows to the next grid line', () => {
    // 19:15 IST = 13:45Z.
    expect(starts([mentor({ rules: daily('19:15', '21:00') })]).free).toEqual([
      '2026-10-24T14:00:00Z',
    ]);
  });

  it('includes windows that cross midnight, including one started the previous day', () => {
    // 22:00 to 02:00 IST every day = 16:30Z to 20:30Z.
    const result = starts([mentor({ rules: daily('22:00', '02:00') })], '2026-10-24T18:00:00Z');

    expect(result.free).toEqual([
      '2026-10-24T18:00:00Z',
      '2026-10-24T18:30:00Z',
      '2026-10-24T19:00:00Z',
    ]);
  });

  it('only uses rules for their weekday and effective dates', () => {
    const sundayOnly: AvailabilityRule = {
      weekday: 7,
      startLocal: '01:30',
      endLocal: '05:30',
      effectiveFrom: '2026-10-25',
      effectiveTo: '2026-10-25',
    };
    // Sun 25 Oct IST 01:30 = Sat 24 Oct 20:00Z; the next Sunday is past effectiveTo.
    const result = starts(
      [mentor({ rules: [sundayOnly] })],
      '2026-10-24T00:00:00Z',
      '2026-11-02T00:00:00Z',
    );

    expect(result.free[0]).toBe('2026-10-24T20:00:00Z');
    expect(result.free.every((slot) => slot.startsWith('2026-10-24'))).toBe(true);
  });

  it('merges overlapping rules without duplicate slots', () => {
    const rules = [...daily('19:00', '21:00'), ...daily('20:00', '23:00')];

    expect(starts([mentor({ rules })]).free).toEqual(starts([mentor()]).free);
  });

  it('follows DST in a mentor zone that observes it (London, 29 Mar 2026)', () => {
    const londonMentor = mentor({ timezone: 'Europe/London', rules: daily('00:00', '03:00') });

    // 00:00 GMT to 03:00 BST is only two real hours: 00:00Z to 02:00Z.
    expect(
      starts(
        [londonMentor],
        '2026-03-29T00:00:00Z',
        '2026-03-29T12:00:00Z',
        CONFIG,
        at('2026-03-20T00:00:00Z'),
      ).free,
    ).toEqual(['2026-03-29T00:00:00Z', '2026-03-29T00:30:00Z']);
  });
});

describe('computeSlots: time off and bookings', () => {
  it('removes slots whose class or buffer meets time off', () => {
    const result = starts([
      mentor({
        timeOff: [{ startsAt: at('2026-10-24T15:00:00Z'), endsAt: at('2026-10-24T15:30:00Z') }],
      }),
    ]);

    // 13:30 ends its buffer at 14:45; 15:30 starts when the time off ends.
    expect(result.free).toEqual([
      '2026-10-24T13:30:00Z',
      '2026-10-24T15:30:00Z',
      '2026-10-24T16:00:00Z',
    ]);
    // Time off is not work: those times do not count as "taken".
    expect(result.scheduled).toEqual(result.free);
  });

  it('keeps [t, t + 75 min) clear of every confirmed [start, blocked_until)', () => {
    const booked = mentor({
      maxTrialsPerDay: 5,
      bookings: [
        {
          startsAt: at('2026-10-24T15:00:00Z'),
          blockedUntil: at('2026-10-24T16:15:00Z'),
          mentorLocalDate: '2026-10-24',
        },
      ],
    });

    expect(starts([booked]).free).toEqual(['2026-10-24T13:30:00Z']);
    expect(starts([booked]).scheduled).toHaveLength(6);
  });

  it('allows a class that starts exactly when the previous buffer ends', () => {
    const config = { ...CONFIG, gridMinutes: 15 };
    const booked = mentor({
      maxTrialsPerDay: 5,
      bookings: [
        {
          startsAt: at('2026-10-24T13:30:00Z'),
          blockedUntil: at('2026-10-24T14:45:00Z'),
          mentorLocalDate: '2026-10-24',
        },
      ],
    });

    expect(starts([booked], undefined, undefined, config).free[0]).toBe('2026-10-24T14:45:00Z');
  });
});

describe('computeSlots: daily cap', () => {
  it('drops every slot on a mentor-local date that reached the cap, but keeps it scheduled', () => {
    const full = mentor({
      bookings: [
        {
          startsAt: at('2026-10-24T13:30:00Z'),
          blockedUntil: at('2026-10-24T14:45:00Z'),
          mentorLocalDate: '2026-10-24',
        },
        {
          startsAt: at('2026-10-24T15:00:00Z'),
          blockedUntil: at('2026-10-24T16:15:00Z'),
          mentorLocalDate: '2026-10-24',
        },
      ],
    });

    const result = starts([full]);

    expect(result.free).toEqual([]);
    expect(result.scheduled.length).toBeGreaterThan(0);
  });

  it('buckets by the mentor-local date: a US Saturday evening counts on Sunday in India', () => {
    // Sat 24 Oct 20:00Z is Sun 25 Oct 01:30 IST. Two Sunday bookings block it, Saturday ones do not.
    const sundayWindow = mentor({ rules: daily('01:30', '05:30') });
    const withSaturday = {
      ...sundayWindow,
      bookings: [
        {
          startsAt: at('2026-10-23T20:00:00Z'),
          blockedUntil: at('2026-10-23T21:15:00Z'),
          mentorLocalDate: '2026-10-24',
        },
        {
          startsAt: at('2026-10-23T21:30:00Z'),
          blockedUntil: at('2026-10-23T22:45:00Z'),
          mentorLocalDate: '2026-10-24',
        },
      ],
    };
    const withSunday = {
      ...sundayWindow,
      bookings: withSaturday.bookings.map((booking) => ({
        ...booking,
        mentorLocalDate: '2026-10-25',
      })),
    };
    const range = ['2026-10-24T19:00:00Z', '2026-10-25T00:00:00Z'] as const;

    expect(starts([withSaturday], ...range).free[0]).toBe('2026-10-24T20:00:00Z');
    expect(starts([withSunday], ...range).free).toEqual([]);
  });
});

describe('computeSlots: lead time, horizon and range', () => {
  it('starts no earlier than the lead time after now', () => {
    const now = at('2026-10-24T10:00:00Z');

    expect(starts([mentor()], undefined, undefined, CONFIG, now).free[0]).toBe(
      '2026-10-24T14:00:00Z',
    );
  });

  it('stops at the horizon', () => {
    const result = starts([mentor()], '2026-10-20T00:00:00Z', '2026-12-01T00:00:00Z');

    expect(result.free.at(-1)).toBe('2026-11-02T16:00:00Z');
    expect(result.scheduled.at(-1)).toBe('2026-11-02T16:00:00Z');
  });

  it('only returns starts inside [from, to)', () => {
    const result = starts([mentor()], '2026-10-24T14:00:00Z', '2026-10-24T15:00:00Z');

    expect(result.free).toEqual(['2026-10-24T14:00:00Z', '2026-10-24T14:30:00Z']);
  });
});

describe('computeSlots: several mentors', () => {
  it('unions mentors and lists who can take each slot', () => {
    const karthik = mentor({ id: 'karthik', rules: daily('21:00', '23:00') });

    const result = starts([mentor(), karthik]).freeWithMentors;

    expect(result.find(([start]) => start === '2026-10-24T13:30:00Z')).toEqual([
      '2026-10-24T13:30:00Z',
      ['priya'],
    ]);
    expect(result.find(([start]) => start === '2026-10-24T15:30:00Z')).toEqual([
      '2026-10-24T15:30:00Z',
      ['priya', 'karthik'],
    ]);
  });

  it('returns nothing without mentors', () => {
    expect(starts([])).toEqual({ free: [], freeWithMentors: [], scheduled: [] });
  });
});
