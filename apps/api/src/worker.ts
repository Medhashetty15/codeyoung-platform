import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { runEntry } from './bootstrap/run-entry';
import { WorkerModule } from './worker.module';

runEntry('worker', async () => {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true,
    abortOnError: false,
  });
  const logger = app.get(Logger);
  app.useLogger(logger);
  // SIGTERM/SIGINT stop scheduling and wait for runs in progress (JobScheduler).
  app.enableShutdownHooks();

  await app.init();
  logger.log('Worker started', 'Bootstrap');
});
