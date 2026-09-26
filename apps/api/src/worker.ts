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
  app.enableShutdownHooks();

  // Holds the event loop open until SIGTERM/SIGINT (handled by the shutdown hooks).
  // Scheduled jobs (BE-07) keep the process alive themselves and replace this timer.
  setInterval(() => undefined, 60_000);

  await app.init();
  logger.log('Worker started', 'Bootstrap');
});
