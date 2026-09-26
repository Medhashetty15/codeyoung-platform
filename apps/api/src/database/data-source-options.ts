import { types } from 'pg';
import { type DataSourceOptions } from 'typeorm';

import { ENTITIES } from './entities';
import { MIGRATIONS } from './migrations';
import { SnakeNamingStrategy } from './snake-naming.strategy';

export type ProcessRole = 'api' | 'worker' | 'cli' | 'test';

/** Queries slower than this are logged as warnings (docs/03 §2). */
const SLOW_QUERY_MS = 200;

const PG_DATE_OID = 1082;

// `date` columns stay 'YYYY-MM-DD' strings: pg would otherwise build a Date at
// local midnight of the process zone (docs/03 §2: no implicit local time).
types.setTypeParser(PG_DATE_OID, (value: string) => value);

/**
 * Connection settings shared by the app modules, the CLI and tests. Schema
 * changes only happen through reviewed migrations; every session runs in UTC.
 */
export function buildDataSourceOptions(databaseUrl: string, role: ProcessRole): DataSourceOptions {
  return {
    type: 'postgres',
    url: databaseUrl,
    applicationName: `codeyoung-${role}`,
    entities: ENTITIES,
    migrations: MIGRATIONS,
    migrationsTableName: 'schema_migrations',
    migrationsTransactionMode: 'each',
    namingStrategy: new SnakeNamingStrategy(),
    synchronize: false,
    migrationsRun: false,
    // Extensions are created by the first migration, not by the ORM at connect time.
    installExtensions: false,
    uuidExtension: 'pgcrypto',
    maxQueryExecutionTime: SLOW_QUERY_MS,
    logging: ['error', 'warn', 'migration'],
    extra: { options: '-c timezone=UTC', max: role === 'cli' ? 2 : 10 },
  };
}
