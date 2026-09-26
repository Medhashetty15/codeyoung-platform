import { isAfter, type Temporal } from '@app/time';

/** docs/03 §6.2: LOGIN_LOCK_THRESHOLD failures within LOGIN_LOCK_MINUTES lock login for as long. */
export interface LockoutPolicy {
  threshold: number;
  minutes: number;
}

export interface LoginFailureState {
  failedAttempts: number;
  windowStartedAt: Temporal.Instant | null;
  lockedUntil: Temporal.Instant | null;
}

export const NO_FAILURES: LoginFailureState = {
  failedAttempts: 0,
  windowStartedAt: null,
  lockedUntil: null,
};

/** The instant login unlocks, or null when the account is not locked at `now`. */
export function lockedUntil(
  state: LoginFailureState,
  now: Temporal.Instant,
): Temporal.Instant | null {
  return state.lockedUntil !== null && isAfter(state.lockedUntil, now) ? state.lockedUntil : null;
}

/**
 * Counts a failed login. The window starts at the first failure and lasts
 * `policy.minutes`; reaching the threshold inside it locks for `policy.minutes`.
 */
export function registerFailure(
  state: LoginFailureState,
  now: Temporal.Instant,
  policy: LockoutPolicy,
): LoginFailureState {
  // While locked, attempts are refused before the password is checked; never extend the lock.
  if (lockedUntil(state, now) !== null) return state;
  const windowOpen =
    state.windowStartedAt !== null &&
    isAfter(state.windowStartedAt.add({ minutes: policy.minutes }), now);
  const failedAttempts = windowOpen ? state.failedAttempts + 1 : 1;
  const windowStartedAt = windowOpen ? state.windowStartedAt : now;
  return {
    failedAttempts,
    windowStartedAt,
    lockedUntil:
      failedAttempts >= policy.threshold
        ? now.add({ minutes: policy.minutes })
        : lockedUntil(state, now),
  };
}
