import { type EntityManager } from 'typeorm';

import { type Temporal, toDate } from '@app/time';

import { type OutboxEvents, type OutboxEventType } from '../domain/outbox-events';

import { OutboxMessageEntity } from './outbox-message.entity';

/**
 * Transactional outbox (ADR 0005): always write with the manager of the
 * business transaction, so the message exists exactly when the change commits.
 */
export class OutboxWriter {
  constructor(private readonly manager: EntityManager) {}

  withManager(manager: EntityManager): OutboxWriter {
    return new OutboxWriter(manager);
  }

  async enqueue<T extends OutboxEventType>(
    type: T,
    payload: OutboxEvents[T],
    runAfter?: Temporal.Instant,
  ): Promise<void> {
    await this.manager.insert(OutboxMessageEntity, {
      type,
      payload: { ...payload },
      ...(runAfter === undefined ? {} : { runAfter: toDate(runAfter) }),
    });
  }
}
