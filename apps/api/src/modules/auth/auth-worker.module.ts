import { Module } from '@nestjs/common';

import { repositoryProvider } from '../../database/repository-provider';

import { CredentialCleanupService } from './application/credential-cleanup.service';
import { ExpiredCredentialsRepository } from './infra/expired-credentials.repository';

/** Auth housekeeping for the worker process. */
@Module({
  providers: [repositoryProvider(ExpiredCredentialsRepository), CredentialCleanupService],
  exports: [CredentialCleanupService],
})
export class AuthWorkerModule {}
