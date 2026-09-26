import { Command, CommandRunner, Option } from 'nest-commander';

import { DatabaseSeeder } from '../../../database/seed/database-seeder';
import { CliOutput } from '../output';
import { Prompt } from '../prompt';

interface SeedCommandOptions {
  reset: boolean;
  yes: boolean;
}

@Command({
  name: 'db:seed',
  description: 'Load demo mentors (Asia/Kolkata) and the demo parent; safe to re-run',
})
export class DbSeedCommand extends CommandRunner {
  constructor(
    private readonly seeder: DatabaseSeeder,
    private readonly prompt: Prompt,
    private readonly output: CliOutput,
  ) {
    super();
  }

  async run(_args: string[], options: Partial<SeedCommandOptions> = {}): Promise<void> {
    const reset = options.reset ?? false;
    if (reset) {
      this.output.line(`--reset empties: ${(await this.seeder.tableNames()).join(', ')}`);
      if (!(await this.prompt.confirm('Delete all this data?', { yes: options.yes ?? false }))) {
        this.output.line('Nothing changed.');
        return;
      }
    }
    const summary = await this.seeder.seed({ reset });
    this.output.line(
      `Mentors: ${summary.mentorsCreated} created, ${summary.mentorsSkipped} already present ` +
        `(${summary.availabilityRulesCreated} availability rules).`,
    );
    this.output.line(
      summary.parentCreated
        ? `Demo parent ${summary.parentEmail} created with ${summary.studentsCreated} children.`
        : `Demo parent ${summary.parentEmail} already present.`,
    );
  }

  @Option({ flags: '--reset', description: 'Empty every application table first' })
  parseReset(): boolean {
    return true;
  }

  @Option({ flags: '-y, --yes', description: 'Skip the confirmation question' })
  parseYes(): boolean {
    return true;
  }
}
