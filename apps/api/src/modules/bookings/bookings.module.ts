import { Module } from '@nestjs/common';

import { KeyedRateLimiter } from '../../common/http/keyed-rate-limiter';
import { repositoryProvider } from '../../database/repository-provider';
import { AvailabilityModule } from '../availability/availability.module';
import { ClassroomModule } from '../classroom/classroom.module';
import { MentorsModule } from '../mentors/mentors.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StudentsModule } from '../students/students.module';
import { UsersModule } from '../users/users.module';

import { BookingPlacer } from './application/booking-placer';
import { BookingViews } from './application/booking-views';
import { CancelBookingService } from './application/cancel-booking.service';
import { CreateBookingService } from './application/create-booking.service';
import { MentorLoads } from './application/mentor-loads';
import { RescheduleBookingService } from './application/reschedule-booking.service';
import { BookingsReadModule } from './bookings-read.module';
import { BookingsController } from './http/bookings.controller';
import { BookingEventsRepository } from './infra/booking-events.repository';
import { BookingsRepository } from './infra/bookings.repository';

/** Booking writes and the parent's booking API (docs/03 §5). */
@Module({
  imports: [
    BookingsReadModule,
    AvailabilityModule,
    MentorsModule,
    StudentsModule,
    UsersModule,
    NotificationsModule,
    ClassroomModule,
  ],
  controllers: [BookingsController],
  providers: [
    repositoryProvider(BookingsRepository),
    repositoryProvider(BookingEventsRepository),
    BookingPlacer,
    BookingViews,
    CreateBookingService,
    CancelBookingService,
    RescheduleBookingService,
    MentorLoads,
    KeyedRateLimiter,
  ],
})
export class BookingsModule {}
