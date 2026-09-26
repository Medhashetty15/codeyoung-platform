import { describe, expect, it } from 'vitest';

import cldr from './__fixtures__/cldr-iana-renames.json' with { type: 'json' };
import {
  canonicalZone,
  deviceZone,
  isValidZone,
  LEGACY_ZONE_ALIASES,
  parseOffsetMinutes,
  sameZone,
  zoneOffset,
  zoneOffsetMinutes,
} from './zones.js';

describe('isValidZone', () => {
  it.each([
    'Asia/Kolkata',
    'Asia/Calcutta',
    'Europe/London',
    'America/New_York',
    'UTC',
    'asia/kolkata',
  ])('accepts %s', (id) => {
    expect(isValidZone(id)).toBe(true);
  });

  it.each([
    'Mars/Olympus',
    '+05:30',
    '-04:00',
    'GMT+05:30',
    '',
    ' Europe/London',
    'Europe/London\n',
    'A'.repeat(80),
  ])('rejects %j', (id) => {
    expect(isValidZone(id)).toBe(false);
  });

  it('rejects non-strings', () => {
    expect(isValidZone(undefined)).toBe(false);
    expect(isValidZone(42)).toBe(false);
  });
});

describe('canonicalZone', () => {
  it('turns legacy ICU ids into current IANA names', () => {
    expect(canonicalZone('Asia/Calcutta')).toBe('Asia/Kolkata');
    expect(canonicalZone('Asia/Kolkata')).toBe('Asia/Kolkata');
    expect(canonicalZone('Europe/Kiev')).toBe('Europe/Kyiv');
    expect(canonicalZone('Asia/Saigon')).toBe('Asia/Ho_Chi_Minh');
  });

  it('fixes letter case', () => {
    expect(canonicalZone('asia/calcutta')).toBe('Asia/Kolkata');
    expect(canonicalZone('EUROPE/LONDON')).toBe('Europe/London');
  });

  it('resolves links the runtime resolves', () => {
    expect(canonicalZone('US/Eastern')).toBe('America/New_York');
    expect(canonicalZone('Etc/UTC')).toBe('UTC');
  });

  it('throws on unknown zones', () => {
    expect(() => canonicalZone('Mars/Olympus')).toThrow(RangeError);
  });

  it('matches the CLDR rename data exactly', () => {
    const fromCldr = Object.fromEntries(
      cldr.groups.flatMap(({ aliases, iana }) =>
        aliases.filter((alias) => alias !== iana).map((alias) => [alias, iana]),
      ),
    );

    expect(LEGACY_ZONE_ALIASES).toEqual(fromCldr);
  });

  it('maps every CLDR alias to the current name on this runtime', () => {
    for (const { aliases, iana } of cldr.groups) {
      for (const alias of aliases) expect(canonicalZone(alias), alias).toBe(iana);
    }
  });

  it('never returns a legacy id for any zone the runtime reports', () => {
    const legacy = new Set(Object.keys(LEGACY_ZONE_ALIASES));
    for (const id of Intl.supportedValuesOf('timeZone')) {
      const canonical = canonicalZone(id);
      expect(legacy.has(canonical), `${id} -> ${canonical}`).toBe(false);
      expect(canonicalZone(canonical), `${id} is idempotent`).toBe(canonical);
    }
  });
});

describe('sameZone', () => {
  it('compares canonical ids', () => {
    expect(sameZone('Asia/Calcutta', 'Asia/Kolkata')).toBe(true);
    expect(sameZone('europe/london', 'Europe/London')).toBe(true);
    expect(sameZone('Europe/London', 'Europe/Dublin')).toBe(false);
  });

  it('is false when either id is invalid', () => {
    expect(sameZone('Mars/Olympus', 'Mars/Olympus')).toBe(false);
  });
});

describe('deviceZone', () => {
  it('returns a canonical zone of this process', () => {
    const zone = deviceZone();

    expect(isValidZone(zone)).toBe(true);
    expect(canonicalZone(zone)).toBe(zone);
  });
});

describe('offsets', () => {
  it('reports ISO offsets per instant, following DST', () => {
    expect(zoneOffset('Europe/London', '2026-10-24T12:00:00Z')).toBe('+01:00');
    expect(zoneOffset('Europe/London', '2026-10-26T12:00:00Z')).toBe('+00:00');
    expect(zoneOffset('Asia/Kolkata', '2026-10-26T12:00:00Z')).toBe('+05:30');
    expect(zoneOffsetMinutes('America/New_York', '2026-07-01T12:00:00Z')).toBe(-240);
  });

  it.each([
    ['+05:30', 330],
    ['-04:00', -240],
    ['+0000', 0],
    ['Z', 0],
  ])('parses %s', (offset, minutes) => {
    expect(parseOffsetMinutes(offset)).toBe(minutes);
  });

  it('rejects malformed offsets', () => {
    expect(() => parseOffsetMinutes('GMT+1')).toThrow(RangeError);
  });
});
