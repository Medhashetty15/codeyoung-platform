import { Command, Option } from 'nest-commander';
import { DataSource } from 'typeorm';

import { type WaitlistStatus } from '../../waitlist/infra/waitlist-entry.entity';
import { WaitlistRepository } from '../../waitlist/infra/waitlist.repository';
import { InvalidOptionError } from '../command-errors';
import { DatabaseCommand } from '../database-command';
import { CliOutput } from '../output';
import { Prompt } from '../prompt';

const MARKS: readonly WaitlistStatus[] = ['CONTACTED', 'CLOSED'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface WaitlistMarkOptions {
  yes: boolean;
}

@Command({
  name: 'waitlist:mark',
  arguments: '<id> <status>',
  description: 'Record the follow-up of a waitlist entry: CONTACTED or CLOSED',
})
export class WaitlistMarkCommand extends DatabaseCommand<WaitlistMarkOptions> {
  constructor(
    dataSource: DataSource,
    private readonly waitlist: WaitlistRepository,
    private readonly prompt: Prompt,
    private readonly output: CliOutput,
  ) {
    super(dataSource);
  }

  protected async execute(args: string[], options: Partial<WaitlistMarkOptions>): Promise<void> {
    const [id = '', value = ''] = args;
    if (!UUID.test(id)) throw new InvalidOptionError(`"${id}" is not a waitlist entry id`);
    const status = MARKS.find((item) => item === value.toUpperCase());
    if (status === undefined) {
      throw new InvalidOptionError(`Status must be ${MARKS.join(' or ')}`);
    }
    if (!(await this.prompt.confirm(`Mark ${id} ${status}?`, { yes: options.yes ?? false }))) {
      this.output.line('Nothing changed.');
      return;
    }
    if (!(await this.waitlist.mark(id, status))) {
      this.output.error(`No waitlist entry ${id}.`);
      return;
    }
    this.output.line(`Marked ${id} ${status}.`);
  }

  @Option({ flags: '-y, --yes', description: 'Skip the confirmation question' })
  parseYes(): boolean {
    return true;
  }
}
