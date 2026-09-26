import { describe, expect, it } from 'vitest';

import { Temporal } from '@app/time';

import { LeastLoadedStrategy, type MentorLoad } from './assignment-strategy';

const load = (mentorId: string, overrides: Partial<MentorLoad> = {}): MentorLoad => ({
  mentorId,
  classesThatDay: 0,
  classesPastWeek: 0,
  lastAssignedAt: null,
  ...overrides,
});
const ids = (loads: MentorLoad[]) => loads.map((item) => item.mentorId);
const at = (iso: string) => Temporal.Instant.from(iso);

describe('LeastLoadedStrategy', () => {
  const strategy = new LeastLoadedStrategy();

  it('prefers the mentor with fewest classes that day', () => {
    expect(ids(strategy.rank([load('a', { classesThatDay: 1 }), load('b')]))).toEqual(['b', 'a']);
  });

  it('then the fewest classes in the past week', () => {
    expect(
      ids(strategy.rank([load('a', { classesPastWeek: 3 }), load('b', { classesPastWeek: 1 })])),
    ).toEqual(['b', 'a']);
  });

  it('then whoever waited longest, never-assigned first', () => {
    expect(
      ids(
        strategy.rank([
          load('a', { lastAssignedAt: at('2026-10-19T10:00:00Z') }),
          load('b', { lastAssignedAt: at('2026-10-18T10:00:00Z') }),
          load('c'),
        ]),
      ),
    ).toEqual(['c', 'b', 'a']);
  });

  it('breaks full ties by mentor id and does not mutate its input', () => {
    const input = [load('z'), load('m'), load('a')];

    expect(ids(strategy.rank(input))).toEqual(['a', 'm', 'z']);
    expect(ids(input)).toEqual(['z', 'm', 'a']);
  });
});
