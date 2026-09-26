/** Longest wait between two attempts of one message (docs/03 §7.1). */
const MAX_BACKOFF_MINUTES = 60;

export type RetryDecision = { kind: 'retry'; delayMinutes: number } | { kind: 'dead' };

/**
 * What to do after a failed attempt. `attempts` counts every attempt so far,
 * this one included: wait min(2^attempts, 60) minutes, or give up once the
 * limit is reached so ops can inspect the message.
 */
export function afterFailure(attempts: number, maxAttempts: number): RetryDecision {
  if (attempts >= maxAttempts) return { kind: 'dead' };
  return { kind: 'retry', delayMinutes: Math.min(2 ** attempts, MAX_BACKOFF_MINUTES) };
}
