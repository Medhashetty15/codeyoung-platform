import { Command, Option } from 'nest-commander';
import { DataSource } from 'typeorm';

import { isoInstant } from '@app/time';

import { type OutboxStatus } from '../../notifications/infra/outbox-message.entity';
import { OutboxQueueRepository } from '../../notifications/infra/outbox-queue.repository';
import { InvalidOptionError } from '../command-errors';
import { DatabaseCommand } from '../database-command';
import { CliOutput } from '../output';

const STATUSES: readonly OutboxStatus[] = ['PENDING', 'PROCESSING', 'DONE', 'DEAD'];
const ERROR_WIDTH = 80;

interface OutboxListOptions {
  status?: string;
  limit?: number;
}

@Command({
  name: 'outbox:list',
  description: 'Outbox messages by status, newest first (default DEAD: emails that gave up)',
})
export class OutboxListCommand extends DatabaseCommand<OutboxListOptions> {
  constructor(
    dataSource: DataSource,
    private readonly outbox: OutboxQueueRepository,
    private readonly output: CliOutput,
  ) {
    super(dataSource);
  }

  protected async execute(_args: string[], options: Partial<OutboxListOptions>): Promise<void> {
    const status = (options.status ?? 'DEAD').toUpperCase() as OutboxStatus;
    if (!STATUSES.includes(status)) {
      throw new InvalidOptionError(`--status must be one of ${STATUSES.join(', ')}`);
    }
    const messages = await this.outbox.list(status, options.limit ?? 50);
    this.output.table(
      ['ID', 'TYPE', 'ATTEMPTS', 'CREATED', 'NEXT RUN', 'LAST ERROR'],
      messages.map((message) => [
        message.id,
        message.type,
        String(message.attempts),
        isoInstant(message.createdAt),
        status === 'PENDING' ? isoInstant(message.runAfter) : '',
        (message.lastError ?? '').replace(/\s+/g, ' ').slice(0, ERROR_WIDTH),
      ]),
    );
  }

  @Option({ flags: '--status <status>', description: 'PENDING, PROCESSING, DONE or DEAD' })
  parseStatus(value: string): string {
    return value;
  }

  @Option({ flags: '--limit <n>', description: 'At most this many (default 50)' })
  parseLimit(value: string): number {
    const limit = Number(value);
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
      throw new InvalidOptionError('--limit must be a whole number from 1 to 1000');
    }
    return limit;
  }
}
