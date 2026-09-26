import { type EntityManager } from 'typeorm';

import { fromDate, type Temporal, toDate } from '@app/time';

import { RefreshTokenEntity } from './refresh-token.entity';

export interface StoredRefreshToken {
  id: string;
  sessionId: string;
  expiresAt: Temporal.Instant;
  usedAt: Temporal.Instant | null;
}

function toToken(row: RefreshTokenEntity): StoredRefreshToken {
  return {
    id: row.id,
    sessionId: row.sessionId,
    expiresAt: fromDate(row.expiresAt),
    usedAt: row.usedAt && fromDate(row.usedAt),
  };
}

/** Refresh tokens are stored as sha256 hashes only. */
export class RefreshTokensRepository {
  constructor(private readonly manager: EntityManager) {}

  withManager(manager: EntityManager): RefreshTokensRepository {
    return new RefreshTokensRepository(manager);
  }

  async insert(sessionId: string, tokenHash: Buffer, expiresAt: Temporal.Instant): Promise<void> {
    await this.manager.insert(RefreshTokenEntity, {
      sessionId,
      tokenHash,
      expiresAt: toDate(expiresAt),
    });
  }

  /** Row-locks the token so parallel refreshes of the same token run one after another. */
  async lockByHash(tokenHash: Buffer): Promise<StoredRefreshToken | null> {
    const row = await this.manager.findOne(RefreshTokenEntity, {
      where: { tokenHash },
      lock: { mode: 'pessimistic_write' },
    });
    return row && toToken(row);
  }

  async markUsed(id: string, at: Temporal.Instant): Promise<void> {
    await this.manager.update(RefreshTokenEntity, { id }, { usedAt: toDate(at) });
  }
}
