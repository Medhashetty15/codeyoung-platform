import { Command, Option } from 'nest-commander';
import { DataSource } from 'typeorm';

import { count } from '../../../common/text/count';
import { MentorScheduleChanges } from '../../bookings/application/mentor-schedule-changes.service';
import { InvalidOptionError } from '../command-errors';
import { DatabaseCommand } from '../database-command';
import { opsActor } from '../ops-actor';
import { booleanOption, capOption, zoneOption } from '../option-parsers';
import { CliOutput } from '../output';
import { Prompt } from '../prompt';

import { runScheduleChange } from './schedule-change-flow';

interface MentorUpdateOptions {
  cap: number;
  tz: string;
  active: boolean;
  reassign: boolean;
  yes: boolean;
}

@Command({
  name: 'mentor:update',
  arguments: '<email>',
  description: 'Change cap, zone or active flag; deactivating with booked classes needs --reassign',
})
export class MentorUpdateCommand extends DatabaseCommand<MentorUpdateOptions> {
  constructor(
    dataSource: DataSource,
    private readonly changes: MentorScheduleChanges,
    private readonly prompt: Prompt,
    private readonly output: CliOutput,
  ) {
    super(dataSource);
  }

  protected async execute(args: string[], options: Partial<MentorUpdateOptions>): Promise<void> {
    const [email = ''] = args;
    const update = {
      ...(options.cap === undefined ? {} : { maxTrialsPerDay: options.cap }),
      ...(options.tz === undefined ? {} : { timezone: options.tz }),
      ...(options.active === undefined ? {} : { isActive: options.active }),
    };
    if (Object.keys(update).length === 0) {
      throw new InvalidOptionError('Nothing to change: give --cap, --tz or --active');
    }
    const settings = { reassign: options.reassign ?? false, actor: opsActor() };
    const outcome = await runScheduleChange({
      output: this.output,
      prompt: this.prompt,
      summary: [`Update mentor ${email}: ${describeUpdate(update)}.`],
      question: 'Apply this change?',
      reassign: settings.reassign,
      yes: options.yes ?? false,
      preview: () => this.changes.update(email, update, { ...settings, dryRun: true }),
      apply: () => this.changes.update(email, update, settings),
    });
    if (outcome !== null) this.output.line(`Updated ${outcome.mentor.fullName}.`);
  }

  @Option({ flags: '--cap <n>', description: 'Trials per mentor-local day (future bookings)' })
  parseCap(value: string): number {
    return capOption(value);
  }

  @Option({ flags: '--tz <zone>', description: 'IANA zone the weekly windows are read in' })
  parseTimezone(value: string): string {
    return zoneOption(value);
  }

  @Option({ flags: '--active <true|false>', description: 'Offer this mentor for new bookings' })
  parseActive(value: string): boolean {
    return booleanOption(value, '--active');
  }

  @Option({ flags: '--reassign', description: 'Move classes the change strands to other mentors' })
  parseReassign(): boolean {
    return true;
  }

  @Option({ flags: '-y, --yes', description: 'Skip the confirmation question' })
  parseYes(): boolean {
    return true;
  }
}

function describeUpdate(update: {
  maxTrialsPerDay?: number;
  timezone?: string;
  isActive?: boolean;
}): string {
  const parts: string[] = [];
  if (update.maxTrialsPerDay !== undefined)
    parts.push(`cap ${count(update.maxTrialsPerDay, 'trial')} a day`);
  if (update.timezone !== undefined) parts.push(`zone ${update.timezone}`);
  if (update.isActive !== undefined) parts.push(update.isActive ? 'active' : 'inactive');
  return parts.join(', ');
}
