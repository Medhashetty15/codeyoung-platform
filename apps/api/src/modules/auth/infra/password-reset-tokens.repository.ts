import { type EntityManager, IsNull } from 'typeorm';

import { fromDate, type Temporal, toDate } from '@app/time';

import { PasswordResetTokenEntity } from './password-reset-token.entity';

export interface StoredResetToken {
  id: string;
  userId: string;
  expiresAt: Temporal.Instant;
  usedAt: Temporal.Instant | null;
}

export class PasswordResetTokensRepository {
  constructor(private readonly manager: EntityManager) {}

  withManager(manager: EntityManager): PasswordResetTokensRepository {
    return new PasswordResetTokensRepository(manager);
  }

  /** A new request supersedes older unused links (E-22). */
  async invalidateUnused(userId: string, at: Temporal.Instant): Promise<void> {
    await this.manager.update(
      PasswordResetTokenEntity,
      { userId, usedAt: IsNull() },
      { usedAt: toDate(at) },
    );
  }

  async insert(userId: string, tokenHash: Buffer, expiresAt: Temporal.Instant): Promise<void> {
    await this.manager.insert(PasswordResetTokenEntity, {
      userId,
      tokenHash,
      expiresAt: toDate(expiresAt),
    });
  }

  async lockByHash(tokenHash: Buffer): Promise<StoredResetToken | null> {
    const row = await this.manager.findOne(PasswordResetTokenEntity, {
      where: { tokenHash },
      lock: { mode: 'pessimistic_write' },
    });
    return (
      row && {
        id: row.id,
        userId: row.userId,
        expiresAt: fromDate(row.expiresAt),
        usedAt: row.usedAt && fromDate(row.usedAt),
      }
    );
  }

  async markUsed(id: string, at: Temporal.Instant): Promise<void> {
    await this.manager.update(PasswordResetTokenEntity, { id }, { usedAt: toDate(at) });
  }
}
