import { Module } from '@nestjs/common';

import { repositoryProvider } from '../../database/repository-provider';

import { AccountDeletionService } from './application/account-deletion.service';
import { AccountDeletionRepository } from './infra/account-deletion.repository';
import { PasswordHasher } from './infra/password-hasher';

/** Account tasks for the ops CLI (A-14). */
@Module({
  providers: [
    repositoryProvider(AccountDeletionRepository),
    PasswordHasher,
    AccountDeletionService,
  ],
  exports: [AccountDeletionService],
})
export class UsersOpsModule {}
