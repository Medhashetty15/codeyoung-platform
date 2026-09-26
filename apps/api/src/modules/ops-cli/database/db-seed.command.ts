import { Command, CommandRunner, Option } from 'nest-commander';

import { canonicalZone, isValidZone } from '@app/time';

import { DatabaseSeeder } from '../../../database/seed/database-seeder';
import { E2eScenarioSeeder } from '../../../database/seed/e2e-scenario';
import { InvalidOptionError } from '../command-errors';
import { CliOutput } from '../output';
import { Prompt } from '../prompt';

interface SeedCommandOptions {
  reset: boolean;
  yes: boolean;
  scenario?: string;
  tz?: string;
  empty: boolean;
}

const SCENARIOS = ['e2e'];

@Command({
  name: 'db:seed',
  description:
    'Load demo mentors (Asia/Kolkata) and the demo parent; safe to re-run. ' +
    '--scenario e2e also prepares a one-slot-left day and a fully booked day (JSON summary)',
})
export class DbSeedCommand extends CommandRunner {
  constructor(
    private readonly seeder: DatabaseSeeder,
    private readonly scenario: E2eScenarioSeeder,
    private readonly prompt: Prompt,
    private readonly output: CliOutput,
  ) {
    super();
  }

  async run(_args: string[], options: Partial<SeedCommandOptions> = {}): Promise<void> {
    if (options.scenario !== undefined && !SCENARIOS.includes(options.scenario)) {
      throw new InvalidOptionError(
        `Unknown scenario "${options.scenario}". Available: ${SCENARIOS.join(', ')}`,
      );
    }
    const timezone = options.tz ?? 'Europe/London';
    if (!isValidZone(timezone)) {
      // The default is valid, so an invalid zone always came from --tz.
      throw new InvalidOptionError(`Unknown time zone "${options.tz ?? ''}"`);
    }
    const reset = (options.reset ?? false) || options.scenario !== undefined;
    if (reset) {
      this.output.line(`Resetting empties: ${(await this.seeder.tableNames()).join(', ')}`);
      if (!(await this.prompt.confirm('Delete all this data?', { yes: options.yes ?? false }))) {
        this.output.line('Nothing changed.');
        return;
      }
    }
    if (options.scenario === 'e2e') {
      const summary = await this.scenario.run({
        timezone: canonicalZone(timezone),
        empty: options.empty ?? false,
      });
      this.output.line(JSON.stringify(summary, null, 2));
      return;
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

  @Option({
    flags: '--scenario <name>',
    description: 'e2e: demo data plus prepared days for end-to-end tests (implies --reset)',
  })
  parseScenario(value: string): string {
    return value;
  }

  @Option({
    flags: '--tz <zone>',
    description: 'Zone whose dates the e2e days follow (default Europe/London)',
  })
  parseTimezone(value: string): string {
    return value;
  }

  @Option({
    flags: '--empty',
    description: 'e2e: deactivate every mentor (empty window, waitlist)',
  })
  parseEmpty(): boolean {
    return true;
  }
}
