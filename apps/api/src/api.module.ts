import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ZodValidationPipe } from 'nestjs-zod';

import { CommonModule } from './common/common.module';
import { ProblemDetailsFilter } from './common/errors/problem-details.filter';
import { ScaledThrottlerGuard } from './common/http/scaled-throttler.guard';
import { LoggerModule } from './common/logging/logger.module';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/http/jwt-auth.guard';
import { AvailabilityModule } from './modules/availability/availability.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { ClassroomModule } from './modules/classroom/classroom.module';
import { HealthModule } from './modules/health/health.module';
import { MentorsModule } from './modules/mentors/mentors.module';
import { MetaModule } from './modules/meta/meta.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { StudentsModule } from './modules/students/students.module';
import { UsersModule } from './modules/users/users.module';
import { WaitlistModule } from './modules/waitlist/waitlist.module';

/** Default limit for every route without a stricter one (docs/03 §6.5). */
const DEFAULT_LIMIT_PER_MINUTE = 120;

@Module({
  imports: [
    ConfigModule,
    CommonModule,
    LoggerModule.forRoot('stdout'),
    DatabaseModule.forRoot('api'),
    // Limits are the documented values; ScaledThrottlerGuard applies RATE_LIMIT_MULTIPLIER.
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: DEFAULT_LIMIT_PER_MINUTE }],
    }),
    HealthModule,
    NotificationsModule,
    UsersModule,
    AuthModule,
    StudentsModule,
    BookingsModule,
    ClassroomModule,
    MentorsModule,
    AvailabilityModule,
    MetaModule,
    WaitlistModule,
  ],
  providers: [
    // Global guards run in this order: rate limit first, then authentication (docs/03 §1).
    { provide: APP_GUARD, useClass: ScaledThrottlerGuard },
    { provide: APP_GUARD, useExisting: JwtAuthGuard },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
  ],
})
export class ApiModule {}
