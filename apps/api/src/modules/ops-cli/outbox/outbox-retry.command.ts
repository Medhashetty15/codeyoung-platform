import { Command, Option } from 'nest-commander';
import { DataSource } from 'typeorm';

import { Clock } from '../../../common/clock/clock';
import { OutboxQueueRepository } from '../../notifications/infra/outbox-queue.repository';
import { InvalidOptionError } from '../command-errors';
import { DatabaseCommand } from '../database-command';
import { CliOutput } from '../output';
import { Prompt } from '../prompt';

interface OutboxRetryOptions {
  allDead: boolean;
  yes: boolean;
}

@Command({
  name: 'outbox:retry',
  arguments: '[id]',
  description:
    'Give a DEAD message (or --all-dead) a fresh set of attempts; the worker sends it next poll',
})
export class OutboxRetryCommand extends DatabaseCommand<OutboxRetryOptions> {
  constructor(
    dataSource: DataSource,
    private readonly outbox: OutboxQueueRepository,
    private readonly clock: Clock,
    private readonly prompt: Prompt,
    private readonly output: CliOutput,
  ) {
    super(dataSource);
  }

  protected async execute(args: string[], options: Partial<OutboxRetryOptions>): Promise<void> {
    const [id] = args;
    const all = options.allDead ?? false;
    if (all === (id !== undefined)) {
      throw new InvalidOptionError('Give one message id or --all-dead');
    }
    if (id !== undefined && !/^\d{1,18}$/.test(id)) {
      throw new InvalidOptionError(`"${id}" is not a message id`);
    }
    const question = all ? 'Retry every DEAD message?' : `Retry message ${id ?? ''}?`;
    if (!(await this.prompt.confirm(question, { yes: options.yes ?? false }))) {
      this.output.line('Nothing changed.');
      return;
    }
    const retried = await this.outbox.retryDead(all ? 'all' : [id ?? ''], this.clock.now());
    if (retried.length === 0) {
      this.output.error(all ? 'No DEAD messages.' : `Message ${id ?? ''} is not DEAD.`);
      return;
    }
    this.output.line(`Queued again: ${retried.join(', ')}.`);
  }

  @Option({ flags: '--all-dead', description: 'Every DEAD message' })
  parseAllDead(): boolean {
    return true;
  }

  @Option({ flags: '-y, --yes', description: 'Skip the confirmation question' })
  parseYes(): boolean {
    return true;
  }
}
