import { describe, expect, it } from 'vitest';

import { formatGmtOffset, zoneCity, zoneLabel, zoneParts } from './labels.js';

describe('zoneLabel', () => {
  it.each([
    ['Europe/London', '2026-10-24T12:00:00Z', 'London time (GMT+1)'],
    ['Europe/London', '2026-10-26T12:00:00Z', 'London time (GMT)'],
    ['America/New_York', '2026-10-24T12:00:00Z', 'Eastern Time (GMT-4)'],
    ['America/New_York', '2026-11-02T12:00:00Z', 'Eastern Time (GMT-5)'],
    ['America/Los_Angeles', '2026-10-24T12:00:00Z', 'Pacific Time (GMT-7)'],
    ['America/Chicago', '2026-01-10T12:00:00Z', 'Central Time (GMT-6)'],
    ['America/Phoenix', '2026-07-01T12:00:00Z', 'Mountain Time (GMT-7)'],
    ['Pacific/Honolulu', '2026-07-01T12:00:00Z', 'Hawaii-Aleutian Time (GMT-10)'],
    ['Asia/Kolkata', '2026-10-24T12:00:00Z', 'Kolkata time (GMT+5:30)'],
    ['Asia/Calcutta', '2026-10-24T12:00:00Z', 'Kolkata time (GMT+5:30)'],
    ['Asia/Kathmandu', '2026-10-24T12:00:00Z', 'Kathmandu time (GMT+5:45)'],
    ['America/St_Johns', '2026-01-10T12:00:00Z', 'St Johns time (GMT-3:30)'],
    ['UTC', '2026-10-24T12:00:00Z', 'UTC'],
  ])('%s at %s is "%s"', (zone, at, label) => {
    expect(zoneLabel(zone, at)).toBe(label);
  });
});

describe('zoneParts', () => {
  it('splits name, city and offset for copy like "5:00 PM London time"', () => {
    expect(zoneParts('Europe/London', '2026-10-24T12:00:00Z')).toEqual({
      name: 'London time',
      city: 'London',
      offset: 'GMT+1',
    });
    expect(zoneParts('America/New_York', '2026-10-24T12:00:00Z')).toEqual({
      name: 'Eastern Time',
      city: 'New York',
      offset: 'GMT-4',
    });
    expect(zoneParts('UTC', '2026-10-24T12:00:00Z')).toEqual({
      name: 'UTC',
      city: 'UTC',
      offset: 'GMT',
    });
  });
});

describe('zoneCity', () => {
  it('uses the last segment of the canonical id', () => {
    expect(zoneCity('America/Argentina/Buenos_Aires')).toBe('Buenos Aires');
    expect(zoneCity('America/Buenos_Aires')).toBe('Buenos Aires');
    expect(zoneCity('Asia/Saigon')).toBe('Ho Chi Minh');
  });
});

describe('formatGmtOffset', () => {
  it.each([
    [0, 'GMT'],
    [60, 'GMT+1'],
    [-240, 'GMT-4'],
    [330, 'GMT+5:30'],
    [345, 'GMT+5:45'],
    [-210, 'GMT-3:30'],
  ])('%i minutes is %s', (minutes, text) => {
    expect(formatGmtOffset(minutes)).toBe(text);
  });
});
