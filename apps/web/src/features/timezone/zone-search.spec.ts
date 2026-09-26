import { describe, expect, it } from 'vitest';

import { buildTimezones } from '@app/contracts/testing';

import { buildZoneEntries, groupZones, matchesZone, visibleZoneGroups } from './zone-search';

// Summer 2026: London on BST, New York on EDT.
const AT = '2026-07-01T12:00:00Z';
const { suggested, all } = buildTimezones();
const suggestedEntries = buildZoneEntries(suggested, AT);
const allEntries = buildZoneEntries(all, AT);
const find = (query: string) => allEntries.filter((e) => matchesZone(e, query)).map((e) => e.id);

describe('zone search', () => {
  it.each([
    ['new york', ['America/New_York']],
    ['Kolkata', ['Asia/Kolkata']],
    ['india', ['Asia/Kolkata']],
    ['united kingdom', ['Europe/London']],
    ['pdt', ['America/Los_Angeles']],
    ['gmt+5:30', ['Asia/Kolkata']],
    ['eastern', ['America/New_York']],
    ['america/los_angeles', ['America/Los_Angeles']],
  ])('"%s" finds %j', (query, expected) => {
    expect(find(query)).toEqual(expected);
  });

  it('labels zones for the dates being viewed', () => {
    const london = allEntries.find((e) => e.id === 'Europe/London');
    expect(london).toMatchObject({ name: 'London time', offset: 'GMT+1' });
    const winter = buildZoneEntries(all, '2026-12-01T12:00:00Z').find(
      (e) => e.id === 'Europe/London',
    );
    expect(winter?.offset).toBe('GMT');
  });
});

describe('grouping', () => {
  const groups = groupZones(suggestedEntries, allEntries);

  it('pins US, UK and India in API order, then every zone by city', () => {
    expect(groups.map((g) => g.value)).toEqual([
      'United States',
      'United Kingdom',
      'India',
      'All time zones',
    ]);
    expect(groups[0]?.items.map((e) => e.city)).toEqual([
      'New York',
      'Chicago',
      'Denver',
      'Los Angeles',
    ]);
    expect(groups.at(-1)?.items[0]?.city).toBe('Chicago');
  });

  it('shows each match once while searching', () => {
    const [matches, ...rest] = visibleZoneGroups(groups, 'new york');
    expect(rest).toHaveLength(0);
    expect(matches?.items.map((e) => e.id)).toEqual(['America/New_York']);
    expect(visibleZoneGroups(groups, ' ')).toBe(groups);
  });
});
