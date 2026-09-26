import { describe, expect, it } from 'vitest';

import { Temporal } from '@app/time';

import { lockedUntil, type LoginFailureState, NO_FAILURES, registerFailure } from './lockout';

const POLICY = { threshold: 10, minutes: 15 };
const T0 = Temporal.Instant.from('2026-10-24T16:00:00Z');
const at = (minutes: number) => T0.add({ minutes });

function fail(
  times: number,
  start: LoginFailureState = NO_FAILURES,
  everyMinutes = 1,
): LoginFailureState {
  let state = start;
  for (let index = 0; index < times; index += 1)
    state = registerFailure(state, at(index * everyMinutes), POLICY);
  return state;
}

describe('login lockout', () => {
  it('counts failures inside the window without locking below the threshold', () => {
    const state = fail(9);

    expect(state.failedAttempts).toBe(9);
    expect(state.windowStartedAt?.equals(T0)).toBe(true);
    expect(lockedUntil(state, at(9))).toBeNull();
  });

  it('locks for 15 minutes on the tenth failure within 15 minutes', () => {
    const state = fail(10);

    expect(lockedUntil(state, at(9))?.equals(at(24))).toBe(true);
    expect(lockedUntil(state, at(23))).not.toBeNull();
    expect(lockedUntil(state, at(24))).toBeNull();
  });

  it('starts a new window once the old one has passed', () => {
    const state = fail(10, NO_FAILURES, 2);

    expect(state.failedAttempts).toBe(2);
    expect(lockedUntil(state, at(18))).toBeNull();
  });

  it('keeps an existing lock when more failures arrive while locked', () => {
    const locked = fail(10);
    const next = registerFailure(locked, at(12), POLICY);

    expect(lockedUntil(next, at(12))?.equals(at(24))).toBe(true);
  });

  it('counts afresh after the lock expires', () => {
    const next = registerFailure(fail(10), at(30), POLICY);

    expect(next).toMatchObject({ failedAttempts: 1 });
    expect(lockedUntil(next, at(30))).toBeNull();
  });
});
