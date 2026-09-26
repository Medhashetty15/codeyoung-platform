import { Module } from '@nestjs/common';

import { repositoryProvider } from '../../database/repository-provider';

import { ConfirmedBookingsQuery } from './infra/confirmed-bookings.query';
import { UpcomingTrialsQuery } from './infra/upcoming-trials.query';

/** Bookings. Booking writes arrive in BE-06; other modules read through its exports. */
@Module({
  providers: [repositoryProvider(UpcomingTrialsQuery), repositoryProvider(ConfirmedBookingsQuery)],
  exports: [UpcomingTrialsQuery, ConfirmedBookingsQuery],
})
export class BookingsModule {}
