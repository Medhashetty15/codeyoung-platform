import { randomBytes } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { Clock } from '../../../common/clock/clock';
import { inLockingTransaction } from '../../../database/transactions';
import {
  AccountDeletionRepository,
  type AccountToDelete,
  type Anonymised,
} from '../infra/account-deletion.repository';
import { PasswordHasher } from '../infra/password-hasher';

/** The account still has classes to attend; nothing was changed. */
export class AccountInUseError extends Error {
  override readonly name = 'AccountInUseError';
}

export class AccountNotFoundError extends Error {
  override readonly name = 'AccountNotFoundError';
}

/**
 * Deletion requests (A-14) handled by ops: the parent and children are
 * anonymised in one transaction; bookings stay for mentor history. Refused
 * while confirmed classes are still ahead (cancel them first, so both sides
 * are told before the address disappears).
 */
@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly accounts: AccountDeletionRepository,
    private readonly hasher: PasswordHasher,
    private readonly clock: Clock,
  ) {}

  /** What the account holds, for the confirmation summary. */
  async describe(email: string): Promise<AccountToDelete> {
    const account = await this.accounts.lockByEmail(email, this.clock.now());
    if (account === null) throw new AccountNotFoundError(`No account with email ${email}`);
    return account;
  }

  async anonymise(email: string): Promise<AccountToDelete & Anonymised> {
    // A password nobody knows; hashed like any other so login stays constant-time.
    const passwordHash = await this.hasher.hash(randomBytes(32).toString('base64url'));
    return inLockingTransaction(this.dataSource, async (manager) => {
      const accounts = this.accounts.withManager(manager);
      const now = this.clock.now();
      const account = await accounts.lockByEmail(email, now);
      if (account === null) throw new AccountNotFoundError(`No account with email ${email}`);
      if (account.upcomingReferences.length > 0) {
        throw new AccountInUseError(
          `The account has upcoming classes: ${account.upcomingReferences.join(', ')}. ` +
            'Cancel them first (booking:cancel), let the worker send the emails, then re-run.',
        );
      }
      const result = await accounts.anonymise(
        {
          userId: account.userId,
          oldEmail: email,
          placeholderEmail: `deleted-${account.userId}@deleted.invalid`,
          passwordHash,
        },
        now,
      );
      this.logger.log({ user: account.userId, ...result }, 'Account anonymised');
      return { ...account, ...result };
    });
  }
}
