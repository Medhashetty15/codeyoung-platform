import { Command, Option } from 'nest-commander';
import { DataSource } from 'typeorm';

import { formatDateTime } from '@app/time';

import { AppConfig } from '../../../config/app-config';
import { type WaitlistStatus } from '../../waitlist/infra/waitlist-entry.entity';
import { WaitlistRepository } from '../../waitlist/infra/waitlist.repository';
import { InvalidOptionError } from '../command-errors';
import { DatabaseCommand } from '../database-command';
import { CliOutput } from '../output';

const STATUSES: readonly WaitlistStatus[] = ['OPEN', 'CONTACTED', 'CLOSED'];

interface WaitlistListOptions {
  status?: string;
}

@Command({
  name: 'waitlist:list',
  description: 'Families waiting for a time (default OPEN; --status all for every entry)',
})
export class WaitlistListCommand extends DatabaseCommand<WaitlistListOptions> {
  constructor(
    dataSource: DataSource,
    private readonly waitlist: WaitlistRepository,
    private readonly config: AppConfig,
    private readonly output: CliOutput,
  ) {
    super(dataSource);
  }

  protected async execute(_args: string[], options: Partial<WaitlistListOptions>): Promise<void> {
    const status = parseStatus(options.status ?? 'OPEN');
    const zone = this.config.booking.mentorDisplayTimezone;
    const entries = await this.waitlist.list(status);
    this.output.table(
      ['ID', 'STATUS', 'JOINED', 'NAME', 'EMAIL', 'ZONE', 'PREFERRED TIMES'],
      entries.map((entry) => [
        entry.id,
        entry.status,
        formatDateTime(entry.createdAt, zone, 'en-GB'),
        entry.fullName,
        entry.email,
        entry.timezone,
        (entry.preferredTimes ?? '').replace(/\s+/g, ' '),
      ]),
    );
  }

  @Option({ flags: '--status <status>', description: 'OPEN, CONTACTED, CLOSED or all' })
  parseStatus(value: string): string {
    return value;
  }
}

function parseStatus(value: string): WaitlistStatus | null {
  const upper = value.toUpperCase();
  if (upper === 'ALL') return null;
  const status = STATUSES.find((item) => item === upper);
  if (status === undefined) {
    throw new InvalidOptionError(`--status must be one of ${STATUSES.join(', ')} or all`);
  }
  return status;
}
