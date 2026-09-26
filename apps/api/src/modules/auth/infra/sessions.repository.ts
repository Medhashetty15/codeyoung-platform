import { type EntityManager, In, IsNull, Not } from 'typeorm';

import { fromDate, type Temporal, toDate } from '@app/time';

import { AuthSessionEntity, type SessionRevokeReason } from './auth-session.entity';

export interface Session {
  id: string;
  userId: string;
  expiresAt: Temporal.Instant;
  revokedAt: Temporal.Instant | null;
}

export interface NewSession {
  userId: string;
  expiresAt: Temporal.Instant;
  userAgent: string | null;
  ip: string | null;
}

function toSession(row: AuthSessionEntity): Session {
  return {
    id: row.id,
    userId: row.userId,
    expiresAt: fromDate(row.expiresAt),
    revokedAt: row.revokedAt && fromDate(row.revokedAt),
  };
}

/** Login sessions ("refresh token families"). */
export class SessionsRepository {
  constructor(private readonly manager: EntityManager) {}

  withManager(manager: EntityManager): SessionsRepository {
    return new SessionsRepository(manager);
  }

  async insert(session: NewSession): Promise<Session> {
    const row = await this.manager.save(
      this.manager.create(AuthSessionEntity, {
        userId: session.userId,
        expiresAt: toDate(session.expiresAt),
        userAgent: session.userAgent,
        ip: session.ip,
      }),
    );
    return toSession(row);
  }

  /** Row-locks the session: refresh, logout and revocation serialise on it. */
  async lockById(id: string): Promise<Session | null> {
    const row = await this.manager.findOne(AuthSessionEntity, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    return row && toSession(row);
  }

  async touch(id: string, at: Temporal.Instant): Promise<void> {
    await this.manager.update(AuthSessionEntity, { id }, { lastUsedAt: toDate(at) });
  }

  async revoke(id: string, reason: SessionRevokeReason, at: Temporal.Instant): Promise<void> {
    await this.manager.update(
      AuthSessionEntity,
      { id, revokedAt: IsNull() },
      { revokedAt: toDate(at), revokeReason: reason },
    );
  }

  /** Revokes every active session of the user, optionally keeping one. Returns how many. */
  async revokeAllForUser(
    userId: string,
    reason: SessionRevokeReason,
    at: Temporal.Instant,
    keepSessionId?: string,
  ): Promise<number> {
    const result = await this.manager.update(
      AuthSessionEntity,
      {
        userId,
        revokedAt: IsNull(),
        ...(keepSessionId === undefined ? {} : { id: Not(In([keepSessionId])) }),
      },
      { revokedAt: toDate(at), revokeReason: reason },
    );
    return result.affected ?? 0;
  }
}
