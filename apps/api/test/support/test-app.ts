import { type Type } from '@nestjs/common';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { inject } from 'vitest';

import { ApiModule } from '../../src/api.module';
import { configureHttpApp, HTTP_APP_OPTIONS } from '../../src/bootstrap/configure-http-app';
import { AppConfig } from '../../src/config/app-config';

export interface TestAppOptions {
  env?: Record<string, string>;
  controllers?: Type[];
}

/** Boots the real API module with the production HTTP pipeline against the test database. */
export async function createTestApp(options: TestAppOptions = {}): Promise<NestExpressApplication> {
  const config = AppConfig.fromEnv({
    NODE_ENV: 'test',
    DATABASE_URL: inject('databaseUrl'),
    LOG_LEVEL: 'silent',
    WEB_BASE_URL: 'http://localhost:5173',
    ...options.env,
  });
  const moduleRef = await Test.createTestingModule({
    imports: [ApiModule],
    controllers: options.controllers ?? [],
  })
    .overrideProvider(AppConfig)
    .useValue(config)
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>(HTTP_APP_OPTIONS);
  app.useLogger(app.get(Logger));
  configureHttpApp(app);
  await app.init();
  return app;
}
