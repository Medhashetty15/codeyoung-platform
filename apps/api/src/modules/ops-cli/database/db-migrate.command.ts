import { Command, CommandRunner } from 'nest-commander';
import { DataSource } from 'typeorm';

import { ensureConnected } from '../../../database/connect';
import { CliOutput } from '../output';

@Command({ name: 'db:migrate', description: 'Apply all pending migrations' })
export class DbMigrateCommand extends CommandRunner {
  constructor(
    private readonly dataSource: DataSource,
    private readonly output: CliOutput,
  ) {
    super();
  }

  async run(): Promise<void> {
    await ensureConnected(this.dataSource);
    const applied = await this.dataSource.runMigrations({ transaction: 'each' });
    if (applied.length === 0) {
      this.output.line('Database is up to date.');
      return;
    }
    for (const migration of applied) this.output.line(`Applied ${migration.name}`);
  }
}
