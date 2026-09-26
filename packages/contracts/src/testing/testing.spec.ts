import { describe, expect, it } from 'vitest';

import { localDateOf, localDates, minutesBetween } from '@app/time';

import { ErrorCode } from '../errors.js';

import {
  buildAuthResponse,
  buildBooking,
  buildBookingConfig,
  buildBookingList,
  buildBookingSummary,
  buildClassroomView,
  buildMe,
  buildProblem,
  buildRefreshResponse,
  buildSlot,
  buildSlotsResponse,
  buildStudent,
  buildStudents,
  buildTimezones,
  buildWaitlistResponse,
  buildZone,
  slotsScenarios,
} from './index.js';

describe('builders', () => {
  it('produce deterministic, schema-valid defaults', () => {
    expect(buildMe()).toEqual(buildMe());
    expect(buildBooking()).toMatchObject({ reference: 'CY-7K3Q9P', student: { firstName: 'Leo' } });
    expect(buildAuthResponse().user.email).toBe('hannah@okafor.co.uk');
    expect(buildRefreshResponse().expiresIn).toBe(900);
    expect(buildBookingSummary().mentor.firstName).toBe('Priya');
    expect(buildBookingList().items).toHaveLength(1);
    expect(buildBookingConfig().mentorTimezone).toBe('Asia/Kolkata');
    expect(buildZone().group).toBe('UK');
    expect(buildTimezones().suggested.map((zone) => zone.id)).toContain('Asia/Kolkata');
    expect(buildClassroomView().classroomOpensMinutesBefore).toBe(10);
    expect(buildWaitlistResponse().status).toBe('OPEN');
    expect(buildSlot()).toEqual({ start: '2026-10-24T16:00:00Z', end: '2026-10-24T17:00:00Z' });
  });

  it('apply overrides and canonicalise zones', () => {
    expect(buildMe({ timezone: 'Asia/Calcutta' }).timezone).toBe('Asia/Kolkata');
    expect(buildStudent({ firstName: 'Arjun', age: 7 })).toMatchObject({
      firstName: 'Arjun',
      age: 7,
    });
    expect(buildBooking({ status: 'CANCELLED', canCancel: false })).toMatchObject({
      status: 'CANCELLED',
    });
  });

  it('fail loudly when an override breaks the contract', () => {
    expect(() => buildStudent({ age: 42 })).toThrow();
    expect(() => buildBooking({ reference: 'CY-ILOU00' })).toThrow();
  });

  it('give Maya an upcoming trial and Leo none', () => {
    const [leo, maya] = buildStudents();

    expect(leo?.upcomingTrial).toBeNull();
    expect(maya?.upcomingTrial).toMatchObject({ start: '2026-10-27T17:00:00Z' });
  });

  it('build every problem code as the API sends it', () => {
    for (const code of Object.values(ErrorCode)) {
      expect(buildProblem(code)).toMatchObject({ code, traceId: expect.any(String) });
    }
    expect(
      buildProblem(ErrorCode.BOOKING_NOT_MODIFIABLE, { reason: 'ALREADY_STARTED' }),
    ).toMatchObject({
      reason: 'ALREADY_STARTED',
    });
  });
});

describe('buildSlotsResponse', () => {
  it('lists every date of the window in order, grouped by the requested zone', () => {
    const response = buildSlotsResponse();

    expect(response.days.map((day) => day.date)).toEqual(localDates('2026-10-24', 14));
    for (const day of response.days) {
      for (const slot of day.slots) expect(localDateOf(slot.start, 'Europe/London')).toBe(day.date);
    }
  });

  it('keeps slots on the 30-minute UTC grid, 60 minutes long, in order', () => {
    const slots = buildSlotsResponse().days.flatMap((day) => day.slots);

    expect(slots.length).toBeGreaterThan(100);
    for (const [index, slot] of slots.entries()) {
      expect(slot.start).toMatch(/T\d{2}:(00|30):00Z$/);
      expect(minutesBetween(slot.start, slot.end)).toBe(60);
      if (index > 0) expect(slot.start > (slots[index - 1]?.start ?? '')).toBe(true);
    }
  });

  it('puts the London fall-back on 25 Oct and New York on 1 Nov', () => {
    const london = slotsScenarios.available().days.filter((day) => day.dstTransition !== undefined);
    const newYork = slotsScenarios
      .availableNewYork()
      .days.filter((day) => day.dstTransition !== undefined);

    expect(london).toEqual([
      expect.objectContaining({
        date: '2026-10-25',
        dstTransition: {
          at: '2026-10-25T01:00:00Z',
          offsetBefore: '+01:00',
          offsetAfter: '+00:00',
        },
      }),
    ]);
    expect(newYork.map((day) => day.date)).toEqual(['2026-11-01']);
  });

  it('points nextAvailable at the first slot', () => {
    const response = slotsScenarios.available();

    expect(response.nextAvailable).toEqual(response.days[0]?.slots[0]);
  });
});

describe('slotsScenarios', () => {
  it('fullyBookedDay empties Mon 26 Oct only', () => {
    const days = slotsScenarios.fullyBookedDay().days;

    expect(days.find((day) => day.date === '2026-10-26')).toMatchObject({
      status: 'FULLY_BOOKED',
      slots: [],
    });
    expect(days.filter((day) => day.status === 'AVAILABLE')).toHaveLength(13);
  });

  it('noAvailabilityDay empties Tue 27 Oct', () => {
    expect(
      slotsScenarios.noAvailabilityDay().days.find((day) => day.date === '2026-10-27'),
    ).toMatchObject({
      status: 'NO_AVAILABILITY',
      slots: [],
    });
  });

  it('windowEmpty has no slots and sends families to the waitlist', () => {
    const response = slotsScenarios.windowEmpty();

    expect(response.nextAvailable).toBeNull();
    expect(response.days.every((day) => day.slots.length === 0)).toBe(true);
    expect(response.days.every((day) => day.status !== 'AVAILABLE')).toBe(true);
  });

  it('dstWeek covers Sat 24 to Sat 31 Oct', () => {
    expect(slotsScenarios.dstWeek().days.map((day) => day.date)).toEqual(
      localDates('2026-10-24', 8),
    );
  });

  it('LA and NY variants use their own zone', () => {
    expect(slotsScenarios.availableLosAngeles().timezone).toBe('America/Los_Angeles');
    expect(slotsScenarios.availableNewYork().timezone).toBe('America/New_York');
  });

  it('returns a fresh object per call', () => {
    const first = slotsScenarios.available();
    first.days.length = 0;

    expect(slotsScenarios.available().days).toHaveLength(14);
  });
});
