import { Command, CommandRunner } from 'nest-commander';
import { DataSource } from 'typeorm';

import { ensureConnected } from '../../../database/connect';
import { pendingSchemaChanges } from '../../../database/schema-drift';
import { CliOutput } from '../output';

@Command({
  name: 'db:drift',
  description: 'Check that migrations and entities describe the same schema (exit 1 on drift)',
})
export class DbDriftCommand extends CommandRunner {
  constructor(
    private readonly dataSource: DataSource,
    private readonly output: CliOutput,
  ) {
    super();
  }

  async run(): Promise<void> {
    await ensureConnected(this.dataSource);
    const changes = await pendingSchemaChanges(this.dataSource);
    if (changes.length === 0) {
      this.output.line('No drift: the schema matches the entities.');
      return;
    }
    this.output.error('Schema drift. The entities would need:');
    for (const change of changes) this.output.error(`  ${change};`);
  }
}
