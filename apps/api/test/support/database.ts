import { randomBytes } from 'node:crypto';

import { Client } from 'pg';
import { DataSource, QueryFailedError } from 'typeorm';
import { expect, inject } from 'vitest';

import { buildDataSourceOptions } from '../../src/database/data-source-options';

export interface TestDatabase {
  url: string;
  drop(): Promise<void>;
}

async function withAdminClient<T>(run: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: inject('databaseUrl') });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

/**
 * A fresh, empty database in the shared test container, so test files can run
 * in parallel without seeing each other's rows.
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  const name = `test_${randomBytes(6).toString('hex')}`;
  await withAdminClient((client) => client.query(`CREATE DATABASE "${name}"`));
  const url = new URL(inject('databaseUrl'));
  url.pathname = `/${name}`;
  return {
    url: url.toString(),
    drop: async () => {
      await withAdminClient((client) => client.query(`DROP DATABASE "${name}" WITH (FORCE)`));
    },
  };
}

/** Connection with the app's options (naming, UTC session, parsers); migrations not yet run. */
export async function connect(url: string): Promise<DataSource> {
  const dataSource = new DataSource({ ...buildDataSourceOptions(url, 'test'), logging: false });
  return dataSource.initialize();
}

export async function connectMigrated(url: string): Promise<DataSource> {
  const dataSource = await connect(url);
  await dataSource.runMigrations({ transaction: 'each' });
  return dataSource;
}

/** SQLSTATE codes the constraint tests assert on. */
export const PG = {
  UNIQUE: '23505',
  FOREIGN_KEY: '23503',
  CHECK: '23514',
  EXCLUSION: '23P01',
} as const;

/** Asserts the statement fails with the SQLSTATE and, when given, the constraint name. */
export async function expectViolation(
  statement: Promise<unknown>,
  code: string,
  constraint?: string,
): Promise<void> {
  const error: unknown = await statement.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(error, 'statement should have been rejected').toBeInstanceOf(QueryFailedError);
  const driverError = (error as QueryFailedError).driverError as {
    code?: string;
    constraint?: string;
  };
  expect(driverError.code).toBe(code);
  if (constraint !== undefined) expect(driverError.constraint).toBe(constraint);
}

/** The only row of a query result; fails the test when there is none. */
export function single<T>(rows: T[]): T {
  const [row] = rows;
  if (row === undefined) throw new Error('expected one row, got none');
  return row;
}
