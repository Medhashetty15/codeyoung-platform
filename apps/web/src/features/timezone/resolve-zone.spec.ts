import { describe, expect, it } from 'vitest';

import { resolveDisplayZone } from './resolve-zone';

describe('resolveDisplayZone', () => {
  const all = {
    url: 'Europe/London',
    chosen: 'Asia/Kolkata',
    profile: 'America/New_York',
    saved: 'America/Los_Angeles',
    device: 'Europe/Dublin',
  };

  it('prefers the URL, then this visit, profile, saved and device', () => {
    expect(resolveDisplayZone(all)).toBe('Europe/London');
    expect(resolveDisplayZone({ ...all, url: null })).toBe('Asia/Kolkata');
    expect(resolveDisplayZone({ ...all, url: null, chosen: null })).toBe('America/New_York');
    expect(resolveDisplayZone({ saved: 'America/Los_Angeles', device: 'Europe/Dublin' })).toBe(
      'America/Los_Angeles',
    );
    expect(resolveDisplayZone({ device: 'Europe/Dublin' })).toBe('Europe/Dublin');
  });

  it('skips invalid ids and falls back to UTC', () => {
    expect(resolveDisplayZone({ url: 'Mars/Olympus', device: 'Europe/Dublin' })).toBe(
      'Europe/Dublin',
    );
    expect(resolveDisplayZone({ url: 'nope' })).toBe('UTC');
    expect(resolveDisplayZone({})).toBe('UTC');
  });

  it('returns canonical ids for legacy aliases', () => {
    expect(resolveDisplayZone({ device: 'Asia/Calcutta' })).toBe('Asia/Kolkata');
    expect(resolveDisplayZone({ url: 'europe/kiev' })).toBe('Europe/Kyiv');
  });
});
