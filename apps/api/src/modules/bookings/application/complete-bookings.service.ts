import { Injectable, Logger } from '@nestjs/common';

import { Clock } from '../../../common/clock/clock';
import { BookingsRepository } from '../infra/bookings.repository';

/** A class counts as held this long after its end (docs/03 §5.3). */
const COMPLETE_AFTER_MINUTES = 60;
/** Rows per transaction, so a backlog never holds many row locks at once. */
const BATCH_SIZE = 500;

/** Worker job: CONFIRMED classes that ended over an hour ago become COMPLETED. */
@Injectable()
export class CompleteBookingsService {
  private readonly logger = new Logger(CompleteBookingsService.name);

  constructor(
    private readonly bookings: BookingsRepository,
    private readonly clock: Clock,
  ) {}

  async run(): Promise<number> {
    const now = this.clock.now();
    const endedBefore = now.subtract({ minutes: COMPLETE_AFTER_MINUTES });
    let total = 0;
    for (;;) {
      const completed = await this.bookings.completeEnded(endedBefore, now, BATCH_SIZE);
      total += completed;
      if (completed < BATCH_SIZE) break;
    }
    if (total > 0) this.logger.log({ completed: total }, 'Completed past bookings');
    return total;
  }
}
