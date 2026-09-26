import { describe, expect, it } from 'vitest';

import { TimezonesResponseSchema } from '@app/contracts';
import { canonicalZone } from '@app/time';

import { buildZoneCatalog } from './zone-catalog';

describe('buildZoneCatalog', () => {
  const catalog = buildZoneCatalog();

  it('matches the contract', () => {
    expect(TimezonesResponseSchema.parse(catalog)).toEqual(catalog);
  });

  it('suggests the US, UK and India zones first, in a fixed order', () => {
    expect(catalog.suggested.map((zone) => zone.id)).toEqual([
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'Europe/London',
      'Asia/Kolkata',
    ]);
    expect(catalog.suggested.map((zone) => zone.group)).toEqual([
      'US',
      'US',
      'US',
      'US',
      'UK',
      'IN',
    ]);
  });

  it('lists only canonical ids, once each (ADR 0017)', () => {
    const ids = catalog.all.map((zone) => zone.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('Asia/Kolkata');
    expect(ids).toContain('Europe/Kyiv');
    expect(ids).not.toContain('Asia/Calcutta');
    expect(ids.every((id) => canonicalZone(id) === id)).toBe(true);
  });

  it('gives each zone a city and a country for search', () => {
    expect(catalog.all.find((zone) => zone.id === 'America/Argentina/Buenos_Aires')).toEqual({
      id: 'America/Argentina/Buenos_Aires',
      city: 'Buenos Aires',
      country: 'Argentina',
    });
    expect(catalog.all.find((zone) => zone.id === 'UTC')).toMatchObject({ city: 'UTC' });
    expect(catalog.all.length).toBeGreaterThan(300);
  });
});
