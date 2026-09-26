import { type EntityManager } from 'typeorm';

import { type Temporal, toDate } from '@app/time';

export interface DeletedCredentials {
  sessions: number;
  refreshTokens: number;
  resetTokens: number;
}

/** Housekeeping deletes for credentials nobody can use any more (docs/03 §7.1). */
export class ExpiredCredentialsRepository {
  constructor(private readonly manager: EntityManager) {}

  /**
   * Refresh and reset tokens go once expired; sessions (with their tokens,
   * by cascade) once they have been expired for `sessionRetentionDays`.
   */
  async deleteExpired(
    now: Temporal.Instant,
    sessionRetentionDays: number,
  ): Promise<DeletedCredentials> {
    const sessionCutoff = now.subtract({ hours: 24 * sessionRetentionDays });
    const [, sessions] = await this.manager.query<[unknown, number]>(
      'DELETE FROM auth_sessions WHERE expires_at < $1',
      [toDate(sessionCutoff)],
    );
    const [, refreshTokens] = await this.manager.query<[unknown, number]>(
      'DELETE FROM refresh_tokens WHERE expires_at < $1',
      [toDate(now)],
    );
    const [, resetTokens] = await this.manager.query<[unknown, number]>(
      'DELETE FROM password_reset_tokens WHERE expires_at < $1',
      [toDate(now)],
    );
    return { sessions, refreshTokens, resetTokens };
  }
}
