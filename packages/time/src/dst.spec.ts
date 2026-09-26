import { describe, expect, it } from 'vitest';

import { describeTransition, dstTransitionsBetween } from './dst.js';

describe('dstTransitionsBetween', () => {
  it('finds London fall-back on 25 Oct 2026', () => {
    expect(
      dstTransitionsBetween('2026-10-24T00:00:00Z', '2026-10-27T00:00:00Z', 'Europe/London'),
    ).toEqual([{ at: '2026-10-25T01:00:00Z', offsetBefore: '+01:00', offsetAfter: '+00:00' }]);
  });

  it('finds New York spring-forward and fall-back in 2026', () => {
    expect(
      dstTransitionsBetween('2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z', 'America/New_York'),
    ).toEqual([
      { at: '2026-03-08T07:00:00Z', offsetBefore: '-05:00', offsetAfter: '-04:00' },
      { at: '2026-11-01T06:00:00Z', offsetBefore: '-04:00', offsetAfter: '-05:00' },
    ]);
  });

  it('returns nothing for zones without DST', () => {
    expect(
      dstTransitionsBetween('2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z', 'Asia/Kolkata'),
    ).toEqual([]);
    expect(dstTransitionsBetween('2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z', 'UTC')).toEqual(
      [],
    );
  });

  it('treats the range as half-open [from, to)', () => {
    const at = '2026-10-25T01:00:00Z';

    expect(dstTransitionsBetween('2026-10-24T00:00:00Z', at, 'Europe/London')).toEqual([]);
    expect(dstTransitionsBetween(at, '2026-10-26T00:00:00Z', 'Europe/London')).toEqual([]);
    expect(
      dstTransitionsBetween('2026-10-25T00:59:59Z', '2026-10-25T01:00:01Z', 'Europe/London'),
    ).toHaveLength(1);
  });
});

describe('describeTransition', () => {
  it('describes a fall-back for the DST notice', () => {
    const [transition] = dstTransitionsBetween(
      '2026-10-24T00:00:00Z',
      '2026-10-27T00:00:00Z',
      'Europe/London',
    );
    if (transition === undefined) throw new Error('expected a transition');

    expect(describeTransition(transition, 'Europe/London')).toEqual({
      direction: 'back',
      minutes: 60,
      localDate: '2026-10-25',
    });
  });

  it('describes a spring-forward', () => {
    expect(
      describeTransition(
        { at: '2026-03-08T07:00:00Z', offsetBefore: '-05:00', offsetAfter: '-04:00' },
        'America/New_York',
      ),
    ).toEqual({ direction: 'forward', minutes: 60, localDate: '2026-03-08' });
  });

  it('handles half-hour changes (Lord Howe Island)', () => {
    const [first] = dstTransitionsBetween(
      '2026-01-01T00:00:00Z',
      '2026-12-31T00:00:00Z',
      'Australia/Lord_Howe',
    );
    if (first === undefined) throw new Error('expected a transition');

    expect(describeTransition(first, 'Australia/Lord_Howe').minutes).toBe(30);
  });
});
