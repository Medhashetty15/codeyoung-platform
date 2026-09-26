import { afterEach, describe, expect, it } from 'vitest';

import { buildBooking, slotsScenarios } from '@app/contracts/testing';

import { nearestFree } from './alternatives';
import { googleCalendarUrl } from './calendar';
import { forgetIdempotencyKey, idempotencyKeyFor } from './idempotency';

describe('idempotency keys', () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it('reuses the key for the same selection and makes a new one when it changes', () => {
    const first = idempotencyKeyFor(['2026-10-24T16:00:00Z', 'leo', 'Europe/London']);
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(idempotencyKeyFor(['2026-10-24T16:00:00Z', 'leo', 'Europe/London'])).toBe(first);
    expect(idempotencyKeyFor(['2026-10-24T16:00:00Z', 'maya', 'Europe/London'])).not.toBe(first);
    expect(idempotencyKeyFor(['2026-10-24T16:00:00Z', 'leo', 'America/New_York'])).not.toBe(first);
  });

  it('starts fresh after the booking succeeded', () => {
    const parts = ['2026-10-24T16:00:00Z', 'leo', 'Europe/London'];
    const first = idempotencyKeyFor(parts);
    forgetIdempotencyKey(parts);
    expect(idempotencyKeyFor(parts)).not.toBe(first);
  });
});

describe('nearestFree', () => {
  it('offers the three closest free times, earliest first, never the lost one', () => {
    const response = slotsScenarios.available();
    const lost = response.days[1]!.slots[3]!;
    const alternatives = nearestFree(response, lost.start);
    expect(alternatives).toHaveLength(3);
    expect(alternatives.map((slot) => slot.start)).not.toContain(lost.start);
    expect([...alternatives].sort((a, b) => a.start.localeCompare(b.start))).toEqual(alternatives);
  });

  it('returns what exists when little is free', () => {
    expect(nearestFree(slotsScenarios.windowEmpty(), '2026-10-24T16:00:00Z')).toEqual([]);
  });
});

describe('googleCalendarUrl', () => {
  it('builds a template link with UTC times and the join link', () => {
    const url = new URL(googleCalendarUrl(buildBooking()));
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('dates')).toBe('20261024T160000Z/20261024T170000Z');
    expect(url.searchParams.get('text')).toBe("Leo's free coding trial with Codeyoung");
    expect(url.searchParams.get('details')).toContain('Reference: CY-7K3Q9P');
  });
});
