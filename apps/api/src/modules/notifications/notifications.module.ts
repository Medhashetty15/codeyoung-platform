import { Module } from '@nestjs/common';

import { repositoryProvider } from '../../database/repository-provider';

import { OutboxWriter } from './infra/outbox-writer';

@Module({
  providers: [repositoryProvider(OutboxWriter)],
  exports: [OutboxWriter],
})
export class NotificationsModule {}
