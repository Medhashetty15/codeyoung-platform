import { type InstantLike } from './types.js';
import { canonicalZone, zoneOffsetMinutes } from './zones.js';

type UsRegion = 'Eastern' | 'Central' | 'Mountain' | 'Pacific' | 'Alaska' | 'Hawaii-Aleutian';

/**
 * US zones are named by their generic region ("Eastern Time"), as Americans
 * say it (docs/05 §11). Fixed here rather than read from Intl so every engine
 * and the email renderer produce the same words. Source: IANA zone.tab (US).
 */
const US_REGIONS: Readonly<Record<string, UsRegion>> = {
  'America/New_York': 'Eastern',
  'America/Detroit': 'Eastern',
  'America/Kentucky/Louisville': 'Eastern',
  'America/Kentucky/Monticello': 'Eastern',
  'America/Indiana/Indianapolis': 'Eastern',
  'America/Indiana/Vincennes': 'Eastern',
  'America/Indiana/Winamac': 'Eastern',
  'America/Indiana/Marengo': 'Eastern',
  'America/Indiana/Petersburg': 'Eastern',
  'America/Indiana/Vevay': 'Eastern',
  'America/Chicago': 'Central',
  'America/Indiana/Tell_City': 'Central',
  'America/Indiana/Knox': 'Central',
  'America/Menominee': 'Central',
  'America/North_Dakota/Center': 'Central',
  'America/North_Dakota/New_Salem': 'Central',
  'America/North_Dakota/Beulah': 'Central',
  'America/Denver': 'Mountain',
  'America/Boise': 'Mountain',
  'America/Phoenix': 'Mountain',
  'America/Los_Angeles': 'Pacific',
  'America/Anchorage': 'Alaska',
  'America/Juneau': 'Alaska',
  'America/Sitka': 'Alaska',
  'America/Metlakatla': 'Alaska',
  'America/Yakutat': 'Alaska',
  'America/Nome': 'Alaska',
  'America/Adak': 'Hawaii-Aleutian',
  'Pacific/Honolulu': 'Hawaii-Aleutian',
};

export interface ZoneParts {
  /** "London time", "Eastern Time", "UTC". */
  name: string;
  /** "London", "New York", "UTC". */
  city: string;
  /** "GMT+1", "GMT-4", "GMT+5:30", or "GMT" at zero offset. */
  offset: string;
}

/** City from the zone id: `America/Argentina/Buenos_Aires` -> `Buenos Aires`. */
export function zoneCity(zone: string): string {
  const id = canonicalZone(zone);
  if (id === 'UTC') return 'UTC';
  return (id.split('/').at(-1) ?? id).replaceAll('_', ' ');
}

/** Offset as people read it: `GMT+1`, `GMT-4`, `GMT+5:30`, `GMT`. */
export function formatGmtOffset(offsetMinutes: number): string {
  if (offsetMinutes === 0) return 'GMT';
  const sign = offsetMinutes > 0 ? '+' : '-';
  const absolute = Math.abs(offsetMinutes);
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;
  return `GMT${sign}${hours}${minutes === 0 ? '' : `:${String(minutes).padStart(2, '0')}`}`;
}

/** Name, city and offset of a zone at a given instant (the offset changes with DST). */
export function zoneParts(zone: string, at: InstantLike): ZoneParts {
  const id = canonicalZone(zone);
  const city = zoneCity(id);
  const offset = formatGmtOffset(zoneOffsetMinutes(id, at));
  const region = US_REGIONS[id];
  if (id === 'UTC') return { name: 'UTC', city, offset };
  return { name: region === undefined ? `${city} time` : `${region} Time`, city, offset };
}

/**
 * Zone label shown next to every time, in UI and emails (docs/04 §5, PD-06):
 * "London time (GMT+1)", "Eastern Time (GMT-4)", "Kolkata time (GMT+5:30)", "UTC".
 */
export function zoneLabel(zone: string, at: InstantLike): string {
  const { name, offset } = zoneParts(zone, at);
  return name === 'UTC' ? 'UTC' : `${name} (${offset})`;
}
