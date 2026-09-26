import { Module } from '@nestjs/common';

import { repositoryProvider } from '../../database/repository-provider';

import { OutboxQueueRepository } from './infra/outbox-queue.repository';
import { OutboxWriter } from './infra/outbox-writer';

/** Writing outbox messages (API) and inspecting them (ops CLI). */
@Module({
  providers: [repositoryProvider(OutboxWriter), repositoryProvider(OutboxQueueRepository)],
  exports: [OutboxWriter, OutboxQueueRepository],
})
export class NotificationsModule {}
