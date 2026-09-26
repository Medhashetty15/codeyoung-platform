import { Module } from '@nestjs/common';

import { BookingsModule } from '../bookings/bookings.module';
import { MentorsModule } from '../mentors/mentors.module';

import { AvailabilityService } from './application/availability.service';
import { AvailabilityController } from './http/availability.controller';

/** Read model over mentors and bookings: the slot engine and the public slots API. */
@Module({
  imports: [MentorsModule, BookingsModule],
  controllers: [AvailabilityController],
  providers: [AvailabilityService],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
