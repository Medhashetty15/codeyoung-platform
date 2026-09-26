import { Test, type TestingModule } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { inject } from 'vitest';

import { Clock } from '../../src/common/clock/clock';
import { AppConfig } from '../../src/config/app-config';
import { MailTransport } from '../../src/modules/notifications/mail/mail-transport';
import { SmtpMailTransport } from '../../src/modules/notifications/mail/smtp-mail-transport';
import { PERIODIC_JOBS } from '../../src/worker/job-scheduler';
import { WorkerModule } from '../../src/worker.module';

import { TEST_JWT_SECRET } from './test-app';

export interface TestWorkerOptions {
  env?: Record<string, string>;
  clock?: Clock;
  /** Wraps the real SMTP transport (Mailpit), e.g. to inject failures. */
  transport?: (smtp: MailTransport) => MailTransport;
}

/**
 * The worker's providers against the test database and the shared Mailpit,
 * with the job loops switched off: tests drive each job explicitly.
 */
export async function createTestWorker(options: TestWorkerOptions = {}): Promise<TestingModule> {
  const config = AppConfig.fromEnv({
    NODE_ENV: 'test',
    DATABASE_URL: inject('databaseUrl'),
    SMTP_URL: inject('smtpUrl'),
    JWT_ACCESS_SECRET: TEST_JWT_SECRET,
    LOG_LEVEL: 'silent',
    WEB_BASE_URL: 'http://localhost:5173',
    ...options.env,
  });
  let builder = Test.createTestingModule({ imports: [WorkerModule] })
    .overrideProvider(AppConfig)
    .useValue(config)
    .overrideProvider(PERIODIC_JOBS)
    .useValue([]);
  if (options.clock !== undefined) {
    builder = builder.overrideProvider(Clock).useValue(options.clock);
  }
  const wrap = options.transport;
  if (wrap !== undefined) {
    builder = builder.overrideProvider(MailTransport).useValue(wrap(new SmtpMailTransport(config)));
  }
  const worker = await builder.compile();
  worker.useLogger(worker.get(Logger));
  await worker.init();
  return worker;
}
