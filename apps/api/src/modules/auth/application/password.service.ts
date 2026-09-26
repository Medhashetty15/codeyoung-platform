import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { ErrorCode } from '@app/contracts';
import { isAfter, isoInstant } from '@app/time';

import { Clock } from '../../../common/clock/clock';
import { AppError } from '../../../common/errors/app-error';
import { AppConfig } from '../../../config/app-config';
import { OutboxWriter } from '../../notifications/infra/outbox-writer';
import { PasswordHasher } from '../../users/infra/password-hasher';
import { UsersRepository } from '../../users/infra/users.repository';
import { PasswordResetTokensRepository } from '../infra/password-reset-tokens.repository';
import { SessionsRepository } from '../infra/sessions.repository';

import { hashOpaqueToken, newOpaqueToken } from './opaque-token';
import { PasswordPolicy } from './password-policy';

/** Forgot, reset and change password (docs/03 §6.2, E-21, E-22, E-24). */
@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly users: UsersRepository,
    private readonly sessions: SessionsRepository,
    private readonly resetTokens: PasswordResetTokensRepository,
    private readonly outbox: OutboxWriter,
    private readonly hasher: PasswordHasher,
    private readonly passwordPolicy: PasswordPolicy,
    private readonly config: AppConfig,
    private readonly clock: Clock,
  ) {}

  /**
   * Emails a single-use reset link when the account exists. The caller always
   * answers 202, so the response never reveals whether an email is registered.
   */
  async requestReset(email: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const user = await this.users.withManager(manager).findByEmail(email);
      if (user === null) return;
      const now = this.clock.now();
      const expiresAt = now.add({ minutes: this.config.auth.passwordResetTtlMinutes });
      const { token, hash } = newOpaqueToken();
      const resetTokens = this.resetTokens.withManager(manager);
      await resetTokens.invalidateUnused(user.id, now);
      await resetTokens.insert(user.id, hash, expiresAt);
      await this.outbox.withManager(manager).enqueue('PasswordResetRequested', {
        userId: user.id,
        token,
        expiresAt: isoInstant(expiresAt),
      });
    });
  }

  /** Sets a new password from a reset link and signs every session out. */
  async reset(token: string, newPassword: string): Promise<void> {
    const hashedToken = hashOpaqueToken(token);
    const reset = await this.dataSource.transaction(async (manager) => {
      const stored = await this.resetTokens.withManager(manager).lockByHash(hashedToken);
      const now = this.clock.now();
      if (stored === null || stored.usedAt !== null || !isAfter(stored.expiresAt, now)) {
        return false;
      }
      const users = this.users.withManager(manager);
      const user = await users.findById(stored.userId);
      if (user === null) return false;

      // Throws WEAK_PASSWORD before anything changes: the link stays usable.
      this.passwordPolicy.assertAcceptable(newPassword, user.email);
      await users.setPassword(user.id, await this.hasher.hash(newPassword), now);
      await this.resetTokens.withManager(manager).markUsed(stored.id, now);
      const revoked = await this.sessions
        .withManager(manager)
        .revokeAllForUser(user.id, 'PASSWORD_RESET', now);
      await this.outbox
        .withManager(manager)
        .enqueue('PasswordChanged', { userId: user.id, reason: 'RESET' });
      this.logger.log({ user: user.id, revokedSessions: revoked }, 'Password reset');
      return true;
    });
    if (!reset) {
      throw new AppError(ErrorCode.RESET_TOKEN_INVALID, {
        detail: 'This reset link is invalid or has expired. Request a new one.',
      });
    }
  }

  /** Changes the password of a signed-in parent; every other session is signed out. */
  async change(
    userId: string,
    sessionId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.users.findById(userId);
    if (user === null || !(await this.hasher.verify(user.passwordHash, currentPassword))) {
      throw new AppError(ErrorCode.INVALID_CREDENTIALS, {
        detail: 'The current password is not correct.',
      });
    }
    this.passwordPolicy.assertAcceptable(newPassword, user.email);
    const passwordHash = await this.hasher.hash(newPassword);

    await this.dataSource.transaction(async (manager) => {
      const now = this.clock.now();
      await this.users.withManager(manager).setPassword(user.id, passwordHash, now);
      const revoked = await this.sessions
        .withManager(manager)
        .revokeAllForUser(user.id, 'PASSWORD_CHANGED', now, sessionId);
      await this.outbox
        .withManager(manager)
        .enqueue('PasswordChanged', { userId: user.id, reason: 'CHANGED' });
      this.logger.log({ user: user.id, revokedSessions: revoked }, 'Password changed');
    });
  }
}
