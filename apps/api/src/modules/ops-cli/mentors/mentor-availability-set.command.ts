import { Command, Option } from 'nest-commander';
import { DataSource } from 'typeorm';

import { todayIn } from '@app/time';

import { Clock } from '../../../common/clock/clock';
import {
  MentorNotFoundError,
  MentorScheduleChanges,
} from '../../bookings/application/mentor-schedule-changes.service';
import { MentorAdminRepository } from '../../mentors/infra/mentor-admin.repository';
import { DatabaseCommand } from '../database-command';
import { opsActor } from '../ops-actor';
import { dateOption, requiredText } from '../option-parsers';
import { CliOutput } from '../output';
import { Prompt } from '../prompt';

import { runScheduleChange } from './schedule-change-flow';
import { previewRows, readWeeklyWindows } from './weekly-windows-file';

interface AvailabilitySetOptions {
  file: string;
  from: string;
  yes: boolean;
}

@Command({
  name: 'mentor:availability:set',
  arguments: '<email>',
  description:
    'Replace the weekly windows from a date on (JSON file); refused if booked classes no longer fit',
})
export class MentorAvailabilitySetCommand extends DatabaseCommand<AvailabilitySetOptions> {
  constructor(
    dataSource: DataSource,
    private readonly mentors: MentorAdminRepository,
    private readonly changes: MentorScheduleChanges,
    private readonly clock: Clock,
    private readonly prompt: Prompt,
    private readonly output: CliOutput,
  ) {
    super(dataSource);
  }

  protected async execute(args: string[], options: Partial<AvailabilitySetOptions>): Promise<void> {
    const [email = ''] = args;
    const windows = await readWeeklyWindows(requiredText(options.file, '--file'));
    const mentor = await this.mentors.findByEmail(email);
    if (mentor === null) throw new MentorNotFoundError(`No mentor with email ${email}`);
    const from =
      options.from === undefined
        ? todayIn(mentor.timezone, this.clock.now())
        : dateOption(options.from, '--from');
    this.output.line(`Weekly windows for ${mentor.fullName} from ${from} (${mentor.timezone}):`);
    this.output.table(
      ['DAY', 'MENTOR', 'NEW YORK', 'LONDON'],
      previewRows(windows, mentor.timezone, from),
    );
    const settings = { reassign: false, actor: opsActor() };
    const outcome = await runScheduleChange({
      output: this.output,
      prompt: this.prompt,
      summary: [],
      question: 'Replace the weekly windows?',
      reassign: false,
      yes: options.yes ?? false,
      preview: () =>
        this.changes.setWeeklyWindows(email, windows, from, { ...settings, dryRun: true }),
      apply: () => this.changes.setWeeklyWindows(email, windows, from, settings),
    });
    if (outcome !== null) this.output.line(`Saved ${String(windows.length)} weekly windows.`);
  }

  @Option({
    flags: '--file <path>',
    description: 'JSON: [{"weekday":"Mon","start":"19:00","end":"23:00"}]',
  })
  parseFile(value: string): string {
    return value;
  }

  @Option({ flags: '--from <date>', description: "First day, YYYY-MM-DD (default mentor's today)" })
  parseFrom(value: string): string {
    return value;
  }

  @Option({ flags: '-y, --yes', description: 'Skip the confirmation question' })
  parseYes(): boolean {
    return true;
  }
}
