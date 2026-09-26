import { isAfter, isBefore, type Temporal } from '@app/time';

export interface PresentedToken {
  expiresAt: Temporal.Instant;
  usedAt: Temporal.Instant | null;
}

export interface TokenSession {
  expiresAt: Temporal.Instant;
  revokedAt: Temporal.Instant | null;
}

/**
 * What to do with a presented refresh token (docs/03 §6.2, E-18, E-19):
 * - INVALID: unknown, expired, or its session is revoked or past the cap;
 * - ROTATE: first use, mark it used and issue a successor;
 * - GRACE: rotated at most `graceSeconds` ago (parallel tabs), issue another successor;
 * - REUSED: rotated earlier than that, so someone else holds it: revoke the session.
 */
export type RefreshDecision = 'INVALID' | 'ROTATE' | 'GRACE' | 'REUSED';

export function decideRefresh(
  token: PresentedToken | null,
  session: TokenSession | null,
  now: Temporal.Instant,
  graceSeconds: number,
): RefreshDecision {
  if (token === null || session === null || session.revokedAt !== null) return 'INVALID';
  if (!isBefore(now, session.expiresAt) || !isBefore(now, token.expiresAt)) return 'INVALID';
  if (token.usedAt === null) return 'ROTATE';
  return isAfter(now, token.usedAt.add({ seconds: graceSeconds })) ? 'REUSED' : 'GRACE';
}
