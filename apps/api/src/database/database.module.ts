import { type DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppConfig } from '../config/app-config';

import { buildDataSourceOptions, type ProcessRole } from './data-source-options';
import { TypeOrmLogger } from './typeorm-logger';

export type { ProcessRole };

/**
 * PostgreSQL connection for one process role. Schema changes only happen
 * through reviewed migrations (`db:migrate`), and every session runs in UTC.
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
            ...buildDataSourceOptions(config.databaseUrl, role),
            logger: new TypeOrmLogger(),
            retryAttempts: config.isProduction ? 10 : 3,
            retryDelay: 2000,
            // CLI commands connect on demand, so commands without a database still run.
            manualInitialization: role === 'cli',
          }),
        }),
      ],
    };
  }
}
