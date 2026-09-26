import { Command, Option } from 'nest-commander';
import { DataSource } from 'typeorm';

import { AppConfig } from '../../../config/app-config';
import { bookingNotFound } from '../../bookings/application/booking-views';
import { CancelBookingService } from '../../bookings/application/cancel-booking.service';
import { OpsBookingsQuery } from '../../bookings/infra/ops-bookings.query';
import { InvalidOptionError } from '../command-errors';
import { DatabaseCommand } from '../database-command';
import { opsActor } from '../ops-actor';
import { CliOutput } from '../output';
import { Prompt } from '../prompt';

import { describeBooking } from './booking-lines';

interface BookingCancelOptions {
  reason?: string;
  yes: boolean;
}

@Command({
  name: 'booking:cancel',
  arguments: '<reference>',
  description:
    'Cancel a booking for ops (E-25); the family gets an apology with a link to book again',
})
export class BookingCancelCommand extends DatabaseCommand<BookingCancelOptions> {
  constructor(
    dataSource: DataSource,
    private readonly bookings: OpsBookingsQuery,
    private readonly cancellations: CancelBookingService,
    private readonly config: AppConfig,
    private readonly prompt: Prompt,
    private readonly output: CliOutput,
  ) {
    super(dataSource);
  }

  protected async execute(args: string[], options: Partial<BookingCancelOptions>): Promise<void> {
    const [reference = ''] = args;
    const reason = options.reason?.trim() ?? '';
    if (reason === '')
      throw new InvalidOptionError('--reason is required, e.g. --reason "Mentor ill"');
    const line = await this.bookings.byReference(reference);
    if (line === null) throw bookingNotFound();
    for (const text of describeBooking(line, this.config.booking.mentorDisplayTimezone)) {
      this.output.line(text);
    }
    this.output.line(`Cancel it (reason: ${reason}) and email the family and the mentor?`);
    if (!(await this.prompt.confirm('Cancel this booking?', { yes: options.yes ?? false }))) {
      this.output.line('Nothing changed.');
      return;
    }
    const cancelled = await this.cancellations.cancelAsOps(reference, reason, opsActor());
    this.output.line(`Cancelled ${cancelled.reference}. Emails go out with the next worker run.`);
  }

  @Option({ flags: '--reason <text>', description: 'Why (required; kept in the audit trail)' })
  parseReason(value: string): string {
    return value;
  }

  @Option({ flags: '-y, --yes', description: 'Skip the confirmation question' })
  parseYes(): boolean {
    return true;
  }
}
