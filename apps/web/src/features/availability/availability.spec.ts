import { describe, expect, it } from 'vitest';

import { buildSlotsResponse, slotsScenarios } from '@app/contracts/testing';

import {
  availabilityLabel,
  dayAccessibleName,
  defaultDate,
  findSlot,
  firstTransition,
  groupByPartOfDay,
  isWindowEmpty,
  nextFreeAfter,
  nextFreeLabel,
} from './slot-logic';
import { parseBookSearch } from './url-state';

describe('parseBookSearch', () => {
  it('keeps valid values and canonicalises the zone', () => {
    expect(
      parseBookSearch(
        new URLSearchParams('tz=Asia/Calcutta&date=2026-10-24&slot=2026-10-24T16:00:00Z'),
      ),
    ).toEqual({ tz: 'Asia/Kolkata', date: '2026-10-24', slot: '2026-10-24T16:00:00Z' });
  });

  it('drops anything invalid instead of failing', () => {
    expect(
      parseBookSearch(new URLSearchParams('tz=Mars/Base&date=2026-13-40&slot=tomorrow')),
    ).toEqual({
      tz: null,
      date: null,
      slot: null,
    });
    expect(parseBookSearch(new URLSearchParams(''))).toEqual({ tz: null, date: null, slot: null });
  });
});

describe('slot logic', () => {
  const available = slotsScenarios.available();

  it('groups slots by the parent local part of day', () => {
    const day = available.days[0]!;
    const groups = groupByPartOfDay(day.slots, 'Europe/London');
    // Fixture mentor windows are IST evenings: London sees them late at night and in the evening.
    expect(groups.map((g) => g.part)).toEqual(['Night', 'Evening']);
    expect(groups.flatMap((g) => g.slots)).toHaveLength(day.slots.length);
    // Hours read in the parent's zone: 09:00 in Kolkata is morning there.
    const kolkata = groupByPartOfDay(
      [{ start: '2026-10-24T03:30:00Z', end: '2026-10-24T04:30:00Z' }],
      'Asia/Kolkata',
    );
    expect(kolkata[0]?.part).toBe('Morning');
  });

  it('labels days for the chip and for screen readers', () => {
    const full = slotsScenarios.fullyBookedDay().days.find((d) => d.date === '2026-10-26')!;
    const none = slotsScenarios.noAvailabilityDay().days.find((d) => d.date === '2026-10-27')!;
    const one = {
      date: '2026-10-24',
      status: 'AVAILABLE' as const,
      slots: [available.days[0]!.slots[0]!],
    };
    expect(availabilityLabel(full)).toBe('Full');
    expect(availabilityLabel(none)).toBe('No classes');
    expect(availabilityLabel(one)).toBe('1 time');
    expect(dayAccessibleName(full, 'en-GB')).toBe('Monday 26 October, fully booked');
    expect(dayAccessibleName(none, 'en-GB')).toBe('Tuesday 27 October, no classes');
    expect(dayAccessibleName(one, 'en-GB')).toBe('Saturday 24 October, 1 time available');
  });

  it('opens on the requested day, else the first day with times', () => {
    const response = buildSlotsResponse({
      dayOverrides: {
        '2026-10-24': { status: 'FULLY_BOOKED' },
        '2026-10-25': { status: 'NO_AVAILABILITY' },
      },
    });
    expect(defaultDate(response.days, '2026-10-30')).toBe('2026-10-30');
    expect(defaultDate(response.days, '2027-01-01')).toBe('2026-10-26');
    expect(defaultDate(response.days, null)).toBe('2026-10-26');
  });

  it('finds the next free time after a full day', () => {
    const response = slotsScenarios.fullyBookedDay();
    const next = nextFreeAfter(response, '2026-10-26');
    expect(next?.start).toBe(response.days.find((d) => d.date === '2026-10-27')?.slots[0]?.start);
    expect(nextFreeLabel(next!, 'Europe/London', 'en-GB')).toMatch(
      /^Next free time: Tue 27 Oct, \d{2}:\d{2}$/,
    );
  });

  it('recognises an empty horizon', () => {
    expect(isWindowEmpty(slotsScenarios.windowEmpty())).toBe(true);
    expect(isWindowEmpty(available)).toBe(false);
    expect(nextFreeAfter(slotsScenarios.windowEmpty(), '2026-10-24')).toBeNull();
  });

  it('finds a slot by start and the first clock change', () => {
    const slot = available.days[2]!.slots[1]!;
    expect(findSlot(available, slot.start)).toEqual(slot);
    expect(findSlot(available, '2026-10-24T00:00:00Z')).toBeNull();
    expect(firstTransition(slotsScenarios.dstWeek())).toEqual({
      at: '2026-10-25T01:00:00Z',
      offsetBefore: '+01:00',
      offsetAfter: '+00:00',
    });
  });
});
