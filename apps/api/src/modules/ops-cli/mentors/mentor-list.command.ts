import { Command } from 'nest-commander';
import { DataSource } from 'typeorm';

import { Clock } from '../../../common/clock/clock';
import { MentorAdminRepository } from '../../mentors/infra/mentor-admin.repository';
import { DatabaseCommand } from '../database-command';
import { CliOutput } from '../output';

@Command({ name: 'mentor:list', description: "Mentors with today's classes and their daily cap" })
export class MentorListCommand extends DatabaseCommand<object> {
  constructor(
    dataSource: DataSource,
    private readonly mentors: MentorAdminRepository,
    private readonly clock: Clock,
    private readonly output: CliOutput,
  ) {
    super(dataSource);
  }

  protected async execute(): Promise<void> {
    const mentors = await this.mentors.list(this.clock.now());
    this.output.table(
      ['NAME', 'EMAIL', 'ZONE', 'TODAY', 'UPCOMING', 'ACTIVE'],
      mentors.map((mentor) => [
        mentor.fullName,
        mentor.email,
        mentor.timezone,
        `${String(mentor.classesToday)}/${String(mentor.maxTrialsPerDay)}`,
        String(mentor.upcomingClasses),
        mentor.isActive ? 'yes' : 'no',
      ]),
    );
  }
}
