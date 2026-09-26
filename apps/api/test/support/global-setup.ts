import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { type TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

/** One throwaway PostgreSQL 17 per integration run, shared by all test files. */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer('postgres:17-alpine')
    .withDatabase('codeyoung_test')
    .withEnvironment({ TZ: 'UTC', PGTZ: 'UTC' })
    .start();

  project.provide('databaseUrl', container.getConnectionUri());

  return async () => {
    await container.stop();
  };
}
