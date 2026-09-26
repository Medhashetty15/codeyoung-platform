import { Module } from '@nestjs/common';

import { CommonModule } from './common/common.module';
import { LoggerModule } from './common/logging/logger.module';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { AuthWorkerModule } from './modules/auth/auth-worker.module';
import { BookingsWorkerModule } from './modules/bookings/bookings-worker.module';
import { NotificationsWorkerModule } from './modules/notifications/notifications-worker.module';
import { JobScheduler } from './worker/job-scheduler';
import { workerJobsProvider } from './worker/worker-jobs';

/** Background process: outbox relay, reminders and housekeeping (docs/03 §7.1). */
@Module({
  imports: [
    ConfigModule,
    CommonModule,
    LoggerModule.forRoot('stdout'),
    DatabaseModule.forRoot('worker'),
    NotificationsWorkerModule,
    BookingsWorkerModule,
    AuthWorkerModule,
  ],
  providers: [workerJobsProvider, JobScheduler],
})
export class WorkerModule {}
