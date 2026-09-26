import { Command, Option } from 'nest-commander';
import { DataSource } from 'typeorm';

import { AppConfig } from '../../../config/app-config';
import { bookingNotFound } from '../../bookings/application/booking-views';
import { ReassignBookingService } from '../../bookings/application/reassign-booking.service';
import { OpsBookingsQuery } from '../../bookings/infra/ops-bookings.query';
import { MentorsRepository } from '../../mentors/infra/mentors.repository';
import { DatabaseCommand } from '../database-command';
import { opsActor } from '../ops-actor';
import { CliOutput } from '../output';
import { Prompt } from '../prompt';

import { describeBooking } from './booking-lines';

interface BookingReassignOptions {
  yes: boolean;
}

@Command({
  name: 'booking:reassign',
  arguments: '<reference>',
  description:
    'Move a booking to the least-loaded free mentor, same time (E-25); everyone is emailed',
})
export class BookingReassignCommand extends DatabaseCommand<BookingReassignOptions> {
  constructor(
    dataSource: DataSource,
    private readonly bookings: OpsBookingsQuery,
    private readonly reassigner: ReassignBookingService,
    private readonly mentors: MentorsRepository,
    private readonly config: AppConfig,
    private readonly prompt: Prompt,
    private readonly output: CliOutput,
  ) {
    super(dataSource);
  }

  protected async execute(args: string[], options: Partial<BookingReassignOptions>): Promise<void> {
    const [reference = ''] = args;
    const line = await this.bookings.byReference(reference);
    if (line === null) throw bookingNotFound();
    for (const text of describeBooking(line, this.config.booking.mentorDisplayTimezone)) {
      this.output.line(text);
    }
    const { mentorIds } = await this.reassigner.candidates(reference);
    const [best] = mentorIds;
    if (best === undefined) {
      this.noMentor(line.reference);
      return;
    }
    const names = await this.mentors.firstNames(mentorIds);
    this.output.line(
      `Free mentors, best first: ${mentorIds.map((id) => names.get(id) ?? id).join(', ')}`,
    );
    if (
      !(await this.prompt.confirm(`Move it to ${names.get(best) ?? best}?`, {
        yes: options.yes ?? false,
      }))
    ) {
      this.output.line('Nothing changed.');
      return;
    }
    const outcome = await this.reassigner.reassign(reference, opsActor());
    if (outcome.kind === 'no-mentor') {
      this.noMentor(line.reference);
      return;
    }
    const moved = await this.bookings.byReference(reference);
    this.output.line(
      `Reassigned ${outcome.booking.reference} to ${moved?.mentorName ?? outcome.booking.mentorId}. ` +
        'Emails go out with the next worker run.',
    );
  }

  private noMentor(reference: string): void {
    this.output.error(
      `No other mentor is free for ${reference}. Cancel it with: ` +
        `booking:cancel ${reference} --reason "<why>"`,
    );
  }

  @Option({ flags: '-y, --yes', description: 'Skip the confirmation question' })
  parseYes(): boolean {
    return true;
  }
}
