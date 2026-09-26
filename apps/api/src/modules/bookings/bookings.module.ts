import { Module } from '@nestjs/common';

import { repositoryProvider } from '../../database/repository-provider';

import { UpcomingTrialsQuery } from './infra/upcoming-trials.query';

/** Bookings. Booking writes arrive in BE-06; other modules read through its exports. */
@Module({
  providers: [repositoryProvider(UpcomingTrialsQuery)],
  exports: [UpcomingTrialsQuery],
})
export class BookingsModule {}
