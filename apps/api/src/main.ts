import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';

import { ApiModule } from './api.module';
import { configureHttpApp, HTTP_APP_OPTIONS } from './bootstrap/configure-http-app';
import { runEntry } from './bootstrap/run-entry';
import { AppConfig } from './config/app-config';

runEntry('api', async () => {
  const app = await NestFactory.create<NestExpressApplication>(ApiModule, HTTP_APP_OPTIONS);
  const logger = app.get(Logger);
  app.useLogger(logger);
  configureHttpApp(app);

  const { port } = app.get(AppConfig);
  await app.listen(port);
  logger.log(`API listening on port ${port}`, 'Bootstrap');
});
