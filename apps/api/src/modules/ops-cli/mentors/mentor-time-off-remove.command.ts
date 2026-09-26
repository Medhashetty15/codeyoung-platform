import { Command, Option } from 'nest-commander';
import { DataSource } from 'typeorm';

import { formatDateTime, zoneLabel } from '@app/time';

import { AppConfig } from '../../../config/app-config';
import { MentorAdminRepository } from '../../mentors/infra/mentor-admin.repository';
import { InvalidOptionError } from '../command-errors';
import { DatabaseCommand } from '../database-command';
import { CliOutput } from '../output';
import { Prompt } from '../prompt';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface TimeOffRemoveOptions {
  yes: boolean;
}

@Command({
  name: 'mentor:time-off:remove',
  arguments: '<id>',
  description: 'Remove a time off period; its times become bookable again',
})
export class MentorTimeOffRemoveCommand extends DatabaseCommand<TimeOffRemoveOptions> {
  constructor(
    dataSource: DataSource,
    private readonly mentors: MentorAdminRepository,
    private readonly config: AppConfig,
    private readonly prompt: Prompt,
    private readonly output: CliOutput,
  ) {
    super(dataSource);
  }

  protected async execute(args: string[], options: Partial<TimeOffRemoveOptions>): Promise<void> {
    const [id = ''] = args;
    const timeOff = UUID.test(id) ? await this.mentors.findTimeOff(id) : null;
    if (timeOff === null) throw new InvalidOptionError(`No time off with id "${id}"`);
    const zone = this.config.booking.mentorDisplayTimezone;
    this.output.line(
      `Time off ${id}: ${formatDateTime(timeOff.startsAt, zone, 'en-GB')} to ` +
        `${formatDateTime(timeOff.endsAt, zone, 'en-GB')} ${zoneLabel(zone, timeOff.startsAt)}.`,
    );
    // Freeing time only adds capacity, so no mentor lock is needed (docs/03 §3.4).
    if (!(await this.prompt.confirm('Remove it?', { yes: options.yes ?? false }))) {
      this.output.line('Nothing changed.');
      return;
    }
    await this.mentors.removeTimeOff(id);
    this.output.line('Removed.');
  }

  @Option({ flags: '-y, --yes', description: 'Skip the confirmation question' })
  parseYes(): boolean {
    return true;
  }
}
