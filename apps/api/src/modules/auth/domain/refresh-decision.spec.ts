import { describe, expect, it } from 'vitest';

import { Temporal } from '@app/time';

import { decideRefresh } from './refresh-decision';

const NOW = Temporal.Instant.from('2026-10-24T16:00:00Z');
const session = { expiresAt: NOW.add({ hours: 24 }), revokedAt: null };
const fresh = { expiresAt: NOW.add({ hours: 1 }), usedAt: null };

describe('decideRefresh', () => {
  it('rotates a fresh token', () => {
    expect(decideRefresh(fresh, session, NOW, 20)).toBe('ROTATE');
  });

  it('rejects unknown tokens and revoked or capped sessions', () => {
    expect(decideRefresh(null, session, NOW, 20)).toBe('INVALID');
    expect(decideRefresh(fresh, null, NOW, 20)).toBe('INVALID');
    expect(decideRefresh(fresh, { ...session, revokedAt: NOW }, NOW, 20)).toBe('INVALID');
    expect(decideRefresh(fresh, { ...session, expiresAt: NOW }, NOW, 20)).toBe('INVALID');
  });

  it('rejects an expired token', () => {
    expect(decideRefresh({ ...fresh, expiresAt: NOW }, session, NOW, 20)).toBe('INVALID');
  });

  it('tolerates a parallel tab within the grace window, inclusive', () => {
    expect(
      decideRefresh({ ...fresh, usedAt: NOW.subtract({ seconds: 5 }) }, session, NOW, 20),
    ).toBe('GRACE');
    expect(
      decideRefresh({ ...fresh, usedAt: NOW.subtract({ seconds: 20 }) }, session, NOW, 20),
    ).toBe('GRACE');
  });

  it('treats a rotated token used after the grace window as reuse', () => {
    expect(
      decideRefresh(
        { ...fresh, usedAt: NOW.subtract({ seconds: 20, milliseconds: 1 }) },
        session,
        NOW,
        20,
      ),
    ).toBe('REUSED');
  });

  it('reports a revoked session as invalid even for a reused token', () => {
    expect(
      decideRefresh(
        { ...fresh, usedAt: NOW.subtract({ minutes: 5 }) },
        { ...session, revokedAt: NOW },
        NOW,
        20,
      ),
    ).toBe('INVALID');
  });
});
