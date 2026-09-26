import { Logger as NestLogger } from '@nestjs/common';
import { type Logger as TypeOrmLoggerInterface } from 'typeorm';

/** Collapses whitespace so multi-line SQL stays on one log line. */
function compact(query: string): string {
  return query.replace(/\s+/g, ' ').trim();
}

/**
 * Routes TypeORM's errors, slow queries, schema and migration messages into the
 * application logger (pino). Query parameters are never logged: they carry
 * emails, password hashes and tokens.
 */
export class TypeOrmLogger implements TypeOrmLoggerInterface {
  private readonly logger = new NestLogger('TypeORM');

  logQuery(): void {
    // Individual queries are not logged; enable pg statement logging to debug.
  }

  logQueryError(error: string | Error, query: string): void {
    const message = error instanceof Error ? error.message : error;
    this.logger.error({ query: compact(query), error: message }, 'Query failed');
  }

  logQuerySlow(time: number, query: string): void {
    this.logger.warn({ query: compact(query), durationMs: time }, 'Slow query');
  }

  logSchemaBuild(message: string): void {
    this.logger.log(message);
  }

  logMigration(message: string): void {
    this.logger.log(message);
  }

  log(level: 'log' | 'info' | 'warn', message: unknown): void {
    if (level === 'warn') this.logger.warn(message);
    else this.logger.log(message);
  }
}
