import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ZodValidationPipe } from 'nestjs-zod';

import { CommonModule } from './common/common.module';
import { ProblemDetailsFilter } from './common/errors/problem-details.filter';
import { LoggerModule } from './common/logging/logger.module';
import { AppConfig } from './config/app-config';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './modules/health/health.module';

/** Default limit for every route without a stricter one (docs/03 §6.5). */
const DEFAULT_LIMIT_PER_MINUTE = 120;

@Module({
  imports: [
    ConfigModule,
    CommonModule,
    LoggerModule.forRoot('stdout'),
    DatabaseModule.forRoot('api'),
    ThrottlerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        throttlers: [
          { name: 'default', ttl: 60_000, limit: config.scaledLimit(DEFAULT_LIMIT_PER_MINUTE) },
        ],
      }),
    }),
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
  ],
})
export class ApiModule {}
