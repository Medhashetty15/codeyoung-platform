import type { Zone } from '@app/contracts';
import { epochMs, nowInstant, zoneParts, type InstantLike } from '@app/time';

export interface ZoneEntry extends Zone {
  /** "London time" / "Eastern Time". */
  name: string;
  /** "GMT+1" for the dates being viewed. */
  offset: string;
  /** Lower-cased haystack: city, country, id, name, offset and short zone names. */
  keywords: string;
}

export interface ZoneGroup {
  value: string;
  items: ZoneEntry[];
}

const GROUP_TITLES = { US: 'United States', UK: 'United Kingdom', IN: 'India' } as const;

/** Abbreviations people search by ("EST", "PDT", "BST"), read from Intl for that date. */
function abbreviations(zone: string, at: InstantLike): string[] {
  const epoch = epochMs(at);
  return ['en-US', 'en-GB'].map(
    (locale) =>
      new Intl.DateTimeFormat(locale, { timeZone: zone, timeZoneName: 'short' })
        .formatToParts(epoch)
        .find((part) => part.type === 'timeZoneName')?.value ?? '',
  );
}

export function buildZoneEntries(zones: Zone[], at: InstantLike = nowInstant()): ZoneEntry[] {
  return zones.map((zone) => {
    const { name, offset } = zoneParts(zone.id, at);
    const keywords = [
      zone.city,
      zone.country,
      zone.id,
      zone.id.replaceAll('_', ' '),
      name,
      offset,
      ...abbreviations(zone.id, at),
    ]
      .join(' ')
      .toLocaleLowerCase();
    return { ...zone, name, offset, keywords };
  });
}

/** Pinned groups in the API's suggested order (United States, United Kingdom, India), then all zones. */
export function groupZones(suggested: ZoneEntry[], all: ZoneEntry[]): ZoneGroup[] {
  const pinned = (Object.keys(GROUP_TITLES) as (keyof typeof GROUP_TITLES)[]).map((key) => ({
    value: GROUP_TITLES[key],
    items: suggested.filter((entry) => entry.group === key),
  }));
  const sorted = [...all].sort((a, b) => a.city.localeCompare(b.city));
  return [
    ...pinned.filter((group) => group.items.length > 0),
    { value: 'All time zones', items: sorted },
  ];
}

/** Every word of the query must appear in the keywords: "new york", "gmt+5:30", "pst", "india". */
export function matchesZone(entry: ZoneEntry, query: string): boolean {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return words.every((word) => entry.keywords.includes(word));
}

/** Pinned groups while the query is empty; otherwise each match once (pinned zones would repeat). */
export function visibleZoneGroups(groups: ZoneGroup[], query: string): ZoneGroup[] {
  if (!query.trim()) return groups;
  const all = groups.at(-1)?.items ?? [];
  return [
    { value: 'Matching time zones', items: all.filter((entry) => matchesZone(entry, query)) },
  ];
}
