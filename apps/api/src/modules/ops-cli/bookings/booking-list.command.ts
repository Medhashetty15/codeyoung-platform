import { Command, Option } from 'nest-commander';
import { DataSource } from 'typeorm';

import { type BookingStatus, BookingStatusSchema } from '@app/contracts';
import {
  addDays,
  isLocalDate,
  type LocalDate,
  startOfLocalDay,
  todayIn,
  zoneLabel,
} from '@app/time';

import { Clock } from '../../../common/clock/clock';
import { AppConfig } from '../../../config/app-config';
import { OpsBookingsQuery } from '../../bookings/infra/ops-bookings.query';
import { InvalidOptionError } from '../command-errors';
import { DatabaseCommand } from '../database-command';
import { CliOutput } from '../output';

import { mentorTime, parentTime } from './booking-lines';

interface BookingListOptions {
  from?: string;
  to?: string;
  mentor?: string;
  status?: string;
}

@Command({
  name: 'booking:list',
  description:
    'Bookings starting on the given days (mentor display zone, default today), ' +
    'with the time for the family',
})
export class BookingListCommand extends DatabaseCommand<BookingListOptions> {
  constructor(
    dataSource: DataSource,
    private readonly bookings: OpsBookingsQuery,
    private readonly config: AppConfig,
    private readonly clock: Clock,
    private readonly output: CliOutput,
  ) {
    super(dataSource);
  }

  protected async execute(_args: string[], options: Partial<BookingListOptions>): Promise<void> {
    const zone = this.config.booking.mentorDisplayTimezone;
    const from = localDate(options.from, '--from') ?? todayIn(zone, this.clock.now());
    const to = localDate(options.to, '--to') ?? from;
    if (to < from) throw new InvalidOptionError('--to must not be before --from');
    const lines = await this.bookings.list({
      from: startOfLocalDay(from, zone),
      to: startOfLocalDay(addDays(to, 1), zone),
      ...(options.mentor === undefined ? {} : { mentorEmail: options.mentor }),
      ...(options.status === undefined ? {} : { status: bookingStatus(options.status) }),
    });
    this.output.line(`Bookings ${from} to ${to}, times in ${zoneLabel(zone, this.clock.now())}:`);
    this.output.table(
      ['REFERENCE', 'STATUS', 'MENTOR TIME', 'FAMILY TIME', 'MENTOR', 'CHILD', 'PARENT'],
      lines.map((line) => [
        line.reference,
        line.status,
        mentorTime(line, zone),
        parentTime(line),
        line.mentorName,
        `${line.childFirstName} (${String(line.childAge)})`,
        `${line.parentName} <${line.parentEmail}>`,
      ]),
    );
  }

  @Option({ flags: '--from <date>', description: 'First day, YYYY-MM-DD (default today)' })
  parseFrom(value: string): string {
    return value;
  }

  @Option({ flags: '--to <date>', description: 'Last day, YYYY-MM-DD (default --from)' })
  parseTo(value: string): string {
    return value;
  }

  @Option({ flags: '--mentor <email>', description: 'Only this mentor' })
  parseMentor(value: string): string {
    return value;
  }

  @Option({
    flags: '--status <status>',
    description: 'CONFIRMED, CANCELLED, RESCHEDULED or COMPLETED',
  })
  parseStatus(value: string): string {
    return value;
  }
}

function localDate(value: string | undefined, flag: string): LocalDate | undefined {
  if (value === undefined) return undefined;
  if (!isLocalDate(value)) throw new InvalidOptionError(`${flag} must be a date like 2026-10-24`);
  return value;
}

function bookingStatus(value: string): BookingStatus {
  const status = BookingStatusSchema.safeParse(value.toUpperCase());
  if (!status.success) {
    throw new InvalidOptionError(
      `--status must be one of ${BookingStatusSchema.options.join(', ')}`,
    );
  }
  return status.data;
}
