import { type DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppConfig } from '../config/app-config';

export type ProcessRole = 'api' | 'worker' | 'cli';

/** Queries slower than this are logged as warnings (docs/03 §2). */
const SLOW_QUERY_MS = 200;

/**
 * PostgreSQL connection. Schema changes only happen through reviewed migrations
 * (`synchronize` and `migrationsRun` stay off), and every session runs in UTC.
 */
@Module({})
export class DatabaseModule {
  static forRoot(role: ProcessRole): DynamicModule {
    return {
      module: DatabaseModule,
      imports: [
        TypeOrmModule.forRootAsync({
          inject: [AppConfig],
          useFactory: (config: AppConfig) => ({
            type: 'postgres',
            url: config.databaseUrl,
            applicationName: `codeyoung-${role}`,
            synchronize: false,
            migrationsRun: false,
            maxQueryExecutionTime: SLOW_QUERY_MS,
            logging: ['error', 'warn'],
            retryAttempts: config.isProduction ? 10 : 3,
            retryDelay: 2000,
            extra: { options: '-c timezone=UTC', max: role === 'cli' ? 2 : 10 },
          }),
        }),
      ],
    };
  }
}
