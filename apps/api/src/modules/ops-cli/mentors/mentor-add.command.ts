import { Command, Option } from 'nest-commander';
import { DataSource } from 'typeorm';

import { EmailSchema } from '@app/contracts';

import { AppConfig } from '../../../config/app-config';
import { isUniqueViolation } from '../../../database/pg-errors';
import { MentorAdminRepository } from '../../mentors/infra/mentor-admin.repository';
import { InvalidOptionError } from '../command-errors';
import { DatabaseCommand } from '../database-command';
import { capOption, requiredText, zoneOption } from '../option-parsers';
import { CliOutput } from '../output';
import { Prompt } from '../prompt';

interface MentorAddOptions {
  name: string;
  email: string;
  tz: string;
  cap: number;
  yes: boolean;
}

@Command({
  name: 'mentor:add',
  description: 'Onboard a mentor (no availability yet: set it with mentor:availability:set)',
})
export class MentorAddCommand extends DatabaseCommand<MentorAddOptions> {
  constructor(
    dataSource: DataSource,
    private readonly mentors: MentorAdminRepository,
    private readonly config: AppConfig,
    private readonly prompt: Prompt,
    private readonly output: CliOutput,
  ) {
    super(dataSource);
  }

  protected async execute(_args: string[], options: Partial<MentorAddOptions>): Promise<void> {
    const fullName = requiredText(options.name, '--name');
    const email = EmailSchema.safeParse(options.email ?? '');
    if (!email.success) throw new InvalidOptionError('--email must be an email address');
    const timezone = zoneOption(requiredText(options.tz, '--tz'));
    const cap = options.cap ?? this.config.booking.defaultMaxTrialsPerDay;
    this.output.line(
      `New mentor: ${fullName} <${email.data}>, ${timezone}, up to ${String(cap)} trials a day.`,
    );
    if (!(await this.prompt.confirm('Add this mentor?', { yes: options.yes ?? false }))) {
      this.output.line('Nothing changed.');
      return;
    }
    try {
      await this.mentors.insert({ fullName, email: email.data, timezone, maxTrialsPerDay: cap });
    } catch (error) {
      if (isUniqueViolation(error, 'mentors_email_key')) {
        throw new InvalidOptionError(`A mentor with email ${email.data} already exists`);
      }
      throw error;
    }
    this.output.line(
      `Added ${fullName}. Next: mentor:availability:set ${email.data} --file availability.json`,
    );
  }

  @Option({ flags: '--name <name>', description: 'Full name', required: true })
  parseName(value: string): string {
    return value;
  }

  @Option({ flags: '--email <email>', description: 'Email for invitations', required: true })
  parseEmail(value: string): string {
    return value;
  }

  @Option({ flags: '--tz <zone>', description: 'IANA zone, e.g. Asia/Kolkata', required: true })
  parseTimezone(value: string): string {
    return value;
  }

  @Option({ flags: '--cap <n>', description: 'Trials per mentor-local day (default from config)' })
  parseCap(value: string): number {
    return capOption(value);
  }

  @Option({ flags: '-y, --yes', description: 'Skip the confirmation question' })
  parseYes(): boolean {
    return true;
  }
}
