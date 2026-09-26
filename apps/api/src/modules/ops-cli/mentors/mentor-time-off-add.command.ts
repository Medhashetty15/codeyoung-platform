import { Command, Option } from 'nest-commander';
import { DataSource } from 'typeorm';

import { formatDateTime, zoneLabel } from '@app/time';

import { AppConfig } from '../../../config/app-config';
import { MentorScheduleChanges } from '../../bookings/application/mentor-schedule-changes.service';
import { InvalidOptionError } from '../command-errors';
import { DatabaseCommand } from '../database-command';
import { opsActor } from '../ops-actor';
import { instantOption, requiredText } from '../option-parsers';
import { CliOutput } from '../output';
import { Prompt } from '../prompt';

import { runScheduleChange } from './schedule-change-flow';

interface TimeOffAddOptions {
  from: string;
  to: string;
  reason: string;
  reassign: boolean;
  yes: boolean;
}

@Command({
  name: 'mentor:time-off:add',
  arguments: '<email>',
  description: 'Block a period (sick day, leave); booked classes in it need --reassign',
})
export class MentorTimeOffAddCommand extends DatabaseCommand<TimeOffAddOptions> {
  constructor(
    dataSource: DataSource,
    private readonly changes: MentorScheduleChanges,
    private readonly config: AppConfig,
    private readonly prompt: Prompt,
    private readonly output: CliOutput,
  ) {
    super(dataSource);
  }

  protected async execute(args: string[], options: Partial<TimeOffAddOptions>): Promise<void> {
    const [email = ''] = args;
    const from = instantOption(requiredText(options.from, '--from'), '--from');
    const to = instantOption(requiredText(options.to, '--to'), '--to');
    if (to.epochMilliseconds <= from.epochMilliseconds) {
      throw new InvalidOptionError('--to must be after --from');
    }
    const range = { from, to, reason: options.reason?.trim() || null };
    const settings = { reassign: options.reassign ?? false, actor: opsActor() };
    const zone = this.config.booking.mentorDisplayTimezone;
    const outcome = await runScheduleChange({
      output: this.output,
      prompt: this.prompt,
      summary: [
        `Time off for ${email}: ${formatDateTime(from, zone, 'en-GB')} to ` +
          `${formatDateTime(to, zone, 'en-GB')} ${zoneLabel(zone, from)}` +
          (range.reason === null ? '.' : ` (${range.reason}).`),
      ],
      question: 'Add this time off?',
      reassign: settings.reassign,
      yes: options.yes ?? false,
      preview: () => this.changes.addTimeOff(email, range, { ...settings, dryRun: true }),
      apply: () => this.changes.addTimeOff(email, range, settings),
    });
    if (outcome !== null) this.output.line(`Added time off ${outcome.value}.`);
  }

  @Option({
    flags: '--from <instant>',
    description: 'Start with offset, e.g. 2026-10-24T00:00+05:30',
  })
  parseFrom(value: string): string {
    return value;
  }

  @Option({ flags: '--to <instant>', description: 'End with offset (exclusive)' })
  parseTo(value: string): string {
    return value;
  }

  @Option({ flags: '--reason <text>', description: 'Why (for ops only)' })
  parseReason(value: string): string {
    return value;
  }

  @Option({
    flags: '--reassign',
    description: 'Move booked classes in the period to other mentors',
  })
  parseReassign(): boolean {
    return true;
  }

  @Option({ flags: '-y, --yes', description: 'Skip the confirmation question' })
  parseYes(): boolean {
    return true;
  }
}
