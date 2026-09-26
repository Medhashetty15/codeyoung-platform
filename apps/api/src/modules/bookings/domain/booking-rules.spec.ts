import { describe, expect, it } from 'vitest';

import { Temporal } from '@app/time';

import { cancelProblem, rescheduleProblem, slotProblem } from './booking-rules';

const NOW = Temporal.Instant.from('2026-10-20T00:00:00Z');
const RULES = { gridMinutes: 30, leadMinutes: 240, horizonDays: 14 };
const at = (iso: string) => Temporal.Instant.from(iso);

describe('slotProblem', () => {
  it('accepts grid-aligned starts inside [now + lead, now + horizon)', () => {
    expect(slotProblem(at('2026-10-20T04:00:00Z'), NOW, RULES)).toBeNull();
    expect(slotProblem(at('2026-11-02T23:30:00Z'), NOW, RULES)).toBeNull();
  });

  it.each([
    ['2026-10-24T16:15:00Z', 'SLOT_NOT_ON_GRID'],
    ['2026-10-24T16:00:30Z', 'SLOT_NOT_ON_GRID'],
    ['2026-10-20T03:30:00Z', 'SLOT_IN_PAST'],
    ['2026-10-19T16:00:00Z', 'SLOT_IN_PAST'],
    ['2026-11-03T00:00:00Z', 'SLOT_OUTSIDE_HORIZON'],
  ])('rejects %s with %s', (start, problem) => {
    expect(slotProblem(at(start), NOW, RULES)).toBe(problem);
  });
});

describe('cancel and reschedule rules', () => {
  const booking = { status: 'CONFIRMED' as const, startsAt: at('2026-10-20T10:00:00Z') };

  it('allows cancelling until the start', () => {
    expect(cancelProblem(booking, at('2026-10-20T09:59:59Z'))).toBeNull();
    expect(cancelProblem(booking, at('2026-10-20T10:00:00Z'))).toBe('ALREADY_STARTED');
    expect(cancelProblem({ ...booking, status: 'CANCELLED' }, NOW)).toBe('NOT_CONFIRMED');
  });

  it('allows rescheduling until 2 hours before the start', () => {
    expect(rescheduleProblem(booking, at('2026-10-20T07:59:00Z'), 120)).toBeNull();
    expect(rescheduleProblem(booking, at('2026-10-20T08:00:00Z'), 120)).toBe(
      'PAST_RESCHEDULE_CUTOFF',
    );
    expect(rescheduleProblem(booking, at('2026-10-20T11:00:00Z'), 120)).toBe('ALREADY_STARTED');
    expect(rescheduleProblem({ ...booking, status: 'RESCHEDULED' }, NOW, 120)).toBe(
      'NOT_CONFIRMED',
    );
  });
});
