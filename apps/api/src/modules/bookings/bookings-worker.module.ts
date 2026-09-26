import { Module } from '@nestjs/common';

import { repositoryProvider } from '../../database/repository-provider';

import { CompleteBookingsService } from './application/complete-bookings.service';
import { BookingsRepository } from './infra/bookings.repository';

/** Booking housekeeping for the worker process. */
@Module({
  providers: [repositoryProvider(BookingsRepository), CompleteBookingsService],
  exports: [CompleteBookingsService],
})
export class BookingsWorkerModule {}
