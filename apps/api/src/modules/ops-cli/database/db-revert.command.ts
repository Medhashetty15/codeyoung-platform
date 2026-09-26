import { Command, CommandRunner, Option } from 'nest-commander';
import { DataSource } from 'typeorm';

import { ensureConnected } from '../../../database/connect';
import { CliOutput } from '../output';
import { Prompt } from '../prompt';

interface RevertOptions {
  yes: boolean;
}

@Command({ name: 'db:revert', description: 'Undo the most recently applied migration' })
export class DbRevertCommand extends CommandRunner {
  constructor(
    private readonly dataSource: DataSource,
    private readonly prompt: Prompt,
    private readonly output: CliOutput,
  ) {
    super();
  }

  async run(_args: string[], options: RevertOptions = { yes: false }): Promise<void> {
    await ensureConnected(this.dataSource);
    const executed: { name: string }[] = await this.dataSource.query(
      `SELECT name FROM "${this.migrationsTable()}" ORDER BY id DESC LIMIT 1`,
    );
    const last = executed[0];
    if (last === undefined) {
      this.output.line('No migration to revert.');
      return;
    }
    this.output.line(`Will revert ${last.name}. What it created, and the data in it, is dropped.`);
    if (!(await this.prompt.confirm('Revert it?', { yes: options.yes }))) {
      this.output.line('Nothing changed.');
      return;
    }
    await this.dataSource.undoLastMigration({ transaction: 'each' });
    this.output.line(`Reverted ${last.name}`);
  }

  @Option({ flags: '-y, --yes', description: 'Skip the confirmation question' })
  parseYes(): boolean {
    return true;
  }

  private migrationsTable(): string {
    return this.dataSource.options.migrationsTableName ?? 'migrations';
  }
}
