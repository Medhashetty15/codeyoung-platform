import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { type TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
    /** SMTP URL of the shared Mailpit. */
    smtpUrl: string;
    /** HTTP API of the shared Mailpit (docs/03 §12: email content asserted via Mailpit). */
    mailpitUrl: string;
  }
}

const SMTP_PORT = 1025;
const HTTP_PORT = 8025;

/** One throwaway PostgreSQL 17 and one Mailpit per integration run, shared by all test files. */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const [postgres, mailpit]: [StartedPostgreSqlContainer, StartedTestContainer] = await Promise.all(
    [
      new PostgreSqlContainer('postgres:17-alpine')
        .withDatabase('codeyoung_test')
        .withEnvironment({ TZ: 'UTC', PGTZ: 'UTC' })
        .start(),
      // Same image as docker-compose.yml.
      new GenericContainer('axllent/mailpit:v1.27')
        .withExposedPorts(SMTP_PORT, HTTP_PORT)
        .withEnvironment({ MP_MAX_MESSAGES: '5000' })
        .withWaitStrategy(Wait.forHttp('/readyz', HTTP_PORT))
        .start(),
    ],
  );

  project.provide('databaseUrl', postgres.getConnectionUri());
  const host = mailpit.getHost();
  project.provide('smtpUrl', `smtp://${host}:${mailpit.getMappedPort(SMTP_PORT)}`);
  project.provide('mailpitUrl', `http://${host}:${mailpit.getMappedPort(HTTP_PORT)}`);

  return async () => {
    await Promise.all([postgres.stop(), mailpit.stop()]);
  };
}
