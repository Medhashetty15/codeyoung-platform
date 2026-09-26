import { Logger } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { TypeOrmLogger } from './typeorm-logger';

describe('TypeOrmLogger', () => {
  it('logs failed queries without their parameters', () => {
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    new TypeOrmLogger().logQueryError(new Error('boom'), 'SELECT *\n  FROM users WHERE email = $1');

    expect(error).toHaveBeenCalledWith(
      { query: 'SELECT * FROM users WHERE email = $1', error: 'boom' },
      'Query failed',
    );
    expect(JSON.stringify(error.mock.calls)).not.toContain('okafor');
  });

  it('warns about slow queries with their duration', () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    new TypeOrmLogger().logQuerySlow(250, 'SELECT 1');

    expect(warn).toHaveBeenCalledWith({ query: 'SELECT 1', durationMs: 250 }, 'Slow query');
  });

  it('never logs individual queries', () => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    new TypeOrmLogger().logQuery();

    expect(log).not.toHaveBeenCalled();
  });

  it('forwards migration, schema and general messages', () => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const logger = new TypeOrmLogger();

    logger.logMigration('Migration InitialSchema has been executed successfully.');
    logger.logSchemaBuild('creating a new table');
    logger.log('info', 'hello');
    logger.log('warn', 'careful');

    expect(log).toHaveBeenCalledTimes(3);
    expect(warn).toHaveBeenCalledWith('careful');
  });
});
