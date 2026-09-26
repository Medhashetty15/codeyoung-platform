import { Module } from '@nestjs/common';

import { CommonModule } from './common/common.module';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { DatabaseSeeder } from './database/seed/database-seeder';
import { E2eScenarioSeeder } from './database/seed/e2e-scenario';
import { AvailabilityModule } from './modules/availability/availability.module';
import { BookingsOpsModule } from './modules/bookings/bookings-ops.module';
import { ClassroomModule } from './modules/classroom/classroom.module';
import { MentorsModule } from './modules/mentors/mentors.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { BookingCancelCommand } from './modules/ops-cli/bookings/booking-cancel.command';
import { BookingListCommand } from './modules/ops-cli/bookings/booking-list.command';
import { BookingReassignCommand } from './modules/ops-cli/bookings/booking-reassign.command';
import { ConfigPrintCommand } from './modules/ops-cli/config-print.command';
import { DbDriftCommand } from './modules/ops-cli/database/db-drift.command';
import { DbMigrateCommand } from './modules/ops-cli/database/db-migrate.command';
import { DbRevertCommand } from './modules/ops-cli/database/db-revert.command';
import { DbSeedCommand } from './modules/ops-cli/database/db-seed.command';
import { MentorAddCommand } from './modules/ops-cli/mentors/mentor-add.command';
import { MentorAvailabilitySetCommand } from './modules/ops-cli/mentors/mentor-availability-set.command';
import { MentorListCommand } from './modules/ops-cli/mentors/mentor-list.command';
import { MentorTimeOffAddCommand } from './modules/ops-cli/mentors/mentor-time-off-add.command';
import { MentorTimeOffRemoveCommand } from './modules/ops-cli/mentors/mentor-time-off-remove.command';
import { MentorUpdateCommand } from './modules/ops-cli/mentors/mentor-update.command';
import { OutboxListCommand } from './modules/ops-cli/outbox/outbox-list.command';
import { OutboxRetryCommand } from './modules/ops-cli/outbox/outbox-retry.command';
import { CliOutput } from './modules/ops-cli/output';
import { Prompt, TerminalPrompt } from './modules/ops-cli/prompt';
import { UserAnonymiseCommand } from './modules/ops-cli/users/user-anonymise.command';
import { WaitlistListCommand } from './modules/ops-cli/waitlist/waitlist-list.command';
import { WaitlistMarkCommand } from './modules/ops-cli/waitlist/waitlist-mark.command';
import { PasswordHasher } from './modules/users/infra/password-hasher';
import { UsersOpsModule } from './modules/users/users-ops.module';
import { WaitlistModule } from './modules/waitlist/waitlist.module';

/** Ops CLI (`npm run cli -- <command>`, docs/03 §10). */
@Module({
  imports: [
    ConfigModule,
    CommonModule,
    DatabaseModule.forRoot('cli'),
    AvailabilityModule,
    ClassroomModule,
    BookingsOpsModule,
    MentorsModule,
    NotificationsModule,
    WaitlistModule,
    UsersOpsModule,
  ],
  providers: [
    { provide: Prompt, useClass: TerminalPrompt },
    CliOutput,
    PasswordHasher,
    DatabaseSeeder,
    E2eScenarioSeeder,
    ConfigPrintCommand,
    DbMigrateCommand,
    DbRevertCommand,
    DbDriftCommand,
    DbSeedCommand,
    BookingListCommand,
    BookingCancelCommand,
    BookingReassignCommand,
    OutboxListCommand,
    OutboxRetryCommand,
    WaitlistListCommand,
    WaitlistMarkCommand,
    MentorListCommand,
    MentorAddCommand,
    MentorUpdateCommand,
    MentorAvailabilitySetCommand,
    MentorTimeOffAddCommand,
    MentorTimeOffRemoveCommand,
    UserAnonymiseCommand,
  ],
})
export class CliModule {}
