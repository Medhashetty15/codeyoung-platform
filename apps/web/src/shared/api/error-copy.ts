import { ApiError } from './ApiError';

/** "30 seconds", "1 minute", "12 minutes": rounded up so the parent never retries too early. */
export function waitText(seconds: number): string {
  if (seconds < 60) {
    const whole = Math.max(1, Math.ceil(seconds));
    return `${String(whole)} ${whole === 1 ? 'second' : 'seconds'}`;
  }
  const minutes = Math.ceil(seconds / 60);
  return `${String(minutes)} ${minutes === 1 ? 'minute' : 'minutes'}`;
}

/** Retry-After from the problem body (retryAfterSeconds) or the header, whichever is present. */
export function retryAfterSeconds(error: ApiError): number | undefined {
  const fromBody = error.extras.retryAfterSeconds;
  return typeof fromBody === 'number' ? fromBody : error.retryAfter;
}

/** Doc 07 §9 "Generic failure", with the support reference when the API returned a trace id. */
export function unreachableText(error: unknown): string {
  const reference = error instanceof ApiError ? error.reference : undefined;
  const base = "We couldn't reach our servers. Check your connection and try again.";
  return reference ? `${base} Reference: ${reference}` : base;
}

/** "Too many attempts. Try again in 12 minutes." for RATE_LIMITED and ACCOUNT_TEMPORARILY_LOCKED. */
export function tooManyAttemptsText(error: ApiError): string {
  const seconds = retryAfterSeconds(error);
  return seconds === undefined
    ? 'Too many attempts. Wait a little and try again.'
    : `Too many attempts. Try again in ${waitText(seconds)}.`;
}
