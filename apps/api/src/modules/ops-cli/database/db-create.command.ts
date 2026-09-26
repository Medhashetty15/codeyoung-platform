import { Command, CommandRunner } from 'nest-commander';

import { AppConfig } from '../../../config/app-config';
import { createDatabaseIfMissing } from '../../../database/create-database';
import { CliOutput } from '../output';

@Command({
  name: 'db:create',
  description: 'Create the database in DATABASE_URL if it does not exist (needs CREATEDB)',
})
export class DbCreateCommand extends CommandRunner {
  constructor(
    private readonly config: AppConfig,
    private readonly output: CliOutput,
  ) {
    super();
  }

  async run(): Promise<void> {
    const name = new URL(this.config.databaseUrl).pathname.slice(1);
    const created = await createDatabaseIfMissing(this.config.databaseUrl);
    this.output.line(created ? `Created database ${name}.` : `Database ${name} already exists.`);
  }
}
