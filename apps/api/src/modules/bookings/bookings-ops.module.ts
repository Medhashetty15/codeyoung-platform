import { Module } from '@nestjs/common';

import { repositoryProvider } from '../../database/repository-provider';
import { AvailabilityModule } from '../availability/availability.module';
import { ClassroomModule } from '../classroom/classroom.module';
import { MentorsModule } from '../mentors/mentors.module';
import { NotificationsModule } from '../notifications/notifications.module';

import { BookingPlacer } from './application/booking-placer';
import { CancelBookingService } from './application/cancel-booking.service';
import { MentorLoads } from './application/mentor-loads';
import { ReassignBookingService } from './application/reassign-booking.service';
import { BookingsReadModule } from './bookings-read.module';
import { BookingEventsRepository } from './infra/booking-events.repository';
import { BookingsRepository } from './infra/bookings.repository';
import { OpsBookingsQuery } from './infra/ops-bookings.query';

/** Ops actions on bookings for the CLI (docs/03 §10): list, cancel, reassign. */
@Module({
  imports: [
    BookingsReadModule,
    AvailabilityModule,
    MentorsModule,
    NotificationsModule,
    ClassroomModule,
  ],
  providers: [
    repositoryProvider(BookingsRepository),
    repositoryProvider(BookingEventsRepository),
    repositoryProvider(OpsBookingsQuery),
    BookingPlacer,
    MentorLoads,
    CancelBookingService,
    ReassignBookingService,
  ],
  exports: [OpsBookingsQuery, CancelBookingService, ReassignBookingService],
})
export class BookingsOpsModule {}
