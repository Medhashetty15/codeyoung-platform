import { describe, expect, it } from 'vitest';

import { buildClassroomView } from '@app/contracts/testing';
import { epochMs } from '@app/time';

import { classroomPhase, clockOffsetMs, countdownSentence } from './phase';

describe('classroomPhase', () => {
  const view = buildClassroomView({
    start: '2026-10-24T16:00:00Z',
    end: '2026-10-24T17:00:00Z',
    classroomOpensMinutesBefore: 10,
  });
  const at = (iso: string) => epochMs(iso);

  it('follows the window: upcoming, open 10 minutes early, ended at the end', () => {
    expect(classroomPhase(view, at('2026-10-24T15:49:59Z'))).toBe('upcoming');
    expect(classroomPhase(view, at('2026-10-24T15:50:00Z'))).toBe('open');
    expect(classroomPhase(view, at('2026-10-24T16:59:59Z'))).toBe('open');
    expect(classroomPhase(view, at('2026-10-24T17:00:00Z'))).toBe('ended');
  });

  it('lets the booking status win over the clock', () => {
    const during = at('2026-10-24T16:10:00Z');
    expect(classroomPhase({ ...view, status: 'CANCELLED' }, during)).toBe('cancelled');
    expect(classroomPhase({ ...view, status: 'RESCHEDULED' }, during)).toBe('moved');
    expect(classroomPhase({ ...view, status: 'COMPLETED' }, during)).toBe('ended');
  });
});

describe('clock skew', () => {
  it('measures how far the device clock is behind or ahead of the server', () => {
    const server = '2026-10-24T16:00:00Z';
    expect(clockOffsetMs(server, epochMs('2026-10-24T15:58:00Z'))).toBe(120_000);
    expect(clockOffsetMs(server, epochMs('2026-10-24T16:00:30Z'))).toBe(-30_000);
  });
});

describe('countdownSentence', () => {
  it('reads naturally and never says zero', () => {
    expect(countdownSentence({ days: 1, hours: 2, minutes: 5 })).toBe('1 day 2 hours 5 minutes');
    expect(countdownSentence({ days: 0, hours: 0, minutes: 1 })).toBe('1 minute');
    expect(countdownSentence({ days: 0, hours: 0, minutes: 0 })).toBe('less than a minute');
  });
});
