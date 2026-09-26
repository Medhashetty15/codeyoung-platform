import { type TimezonesResponse, type Zone } from '@app/contracts';
import { canonicalZone, isValidZone, zoneCity } from '@app/time';

import { ZONE_COUNTRIES } from '../infra/zone-countries';

type ZoneEntry = TimezonesResponse['all'][number];

/** Quick picks shown first in the zone picker (families in the US and UK, mentors in India). */
const SUGGESTED = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Asia/Kolkata',
];

const GROUPS: Record<string, Zone['group']> = { US: 'US', GB: 'UK', IN: 'IN' };

/**
 * Every geographic zone this runtime knows, canonical and de-duplicated
 * (ADR 0017), with city and country for search. Labels and offsets are
 * computed by the client for the dates on screen.
 */
export function buildZoneCatalog(): TimezonesResponse {
  const countryNames = new Intl.DisplayNames('en', { type: 'region' });
  const byId = new Map<string, ZoneEntry>();
  for (const [zone, country] of Object.entries(ZONE_COUNTRIES)) {
    if (!isValidZone(zone)) continue;
    const id = canonicalZone(zone);
    if (byId.has(id)) continue;
    const group = GROUPS[country];
    byId.set(id, {
      id,
      city: zoneCity(id),
      country: countryNames.of(country) ?? country,
      ...(group === undefined ? {} : { group }),
    });
  }
  byId.set('UTC', { id: canonicalZone('UTC'), city: 'UTC', country: 'Coordinated Universal Time' });

  const all = [...byId.values()].sort(
    (a, b) => a.country.localeCompare(b.country) || a.city.localeCompare(b.city),
  );
  const suggested = SUGGESTED.flatMap((id) => {
    const entry = byId.get(id);
    return entry === undefined ? [] : [entry];
  });
  return { suggested, all };
}
