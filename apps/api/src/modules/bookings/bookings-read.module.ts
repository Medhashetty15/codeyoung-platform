import { Module } from '@nestjs/common';

import { repositoryProvider } from '../../database/repository-provider';

import { ConfirmedBookingsQuery } from './infra/confirmed-bookings.query';
import { UpcomingTrialsQuery } from './infra/upcoming-trials.query';

/** Read models over bookings for other modules (availability, students). */
@Module({
  providers: [repositoryProvider(UpcomingTrialsQuery), repositoryProvider(ConfirmedBookingsQuery)],
  exports: [UpcomingTrialsQuery, ConfirmedBookingsQuery],
})
export class BookingsReadModule {}
