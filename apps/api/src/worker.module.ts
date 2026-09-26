import { Module } from '@nestjs/common';

import { CommonModule } from './common/common.module';
import { LoggerModule } from './common/logging/logger.module';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';

/** Background process: outbox relay, reminders and housekeeping (docs/03 §7.1). */
@Module({
  imports: [
    ConfigModule,
    CommonModule,
    LoggerModule.forRoot('stdout'),
    DatabaseModule.forRoot('worker'),
  ],
})
export class WorkerModule {}
