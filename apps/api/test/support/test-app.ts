import { type Server } from 'node:http';
import { type AddressInfo } from 'node:net';

import { type INestApplication, type Type } from '@nestjs/common';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import request from 'supertest';
import { inject } from 'vitest';

import { ApiModule } from '../../src/api.module';
import { configureHttpApp, HTTP_APP_OPTIONS } from '../../src/bootstrap/configure-http-app';
import { Clock } from '../../src/common/clock/clock';
import { AppConfig } from '../../src/config/app-config';

export const TEST_JWT_SECRET = 'integration-test-secret-at-least-32-bytes';

export interface TestAppOptions {
  env?: Record<string, string>;
  controllers?: Type[];
  /** Replaces the system clock (token expiry, lockout, reset links). */
  clock?: Clock;
}

/** Boots the real API module with the production HTTP pipeline against the test database. */
export async function createTestApp(options: TestAppOptions = {}): Promise<NestExpressApplication> {
  const config = AppConfig.fromEnv({
    NODE_ENV: 'test',
    DATABASE_URL: inject('databaseUrl'),
    JWT_ACCESS_SECRET: TEST_JWT_SECRET,
    LOG_LEVEL: 'silent',
    WEB_BASE_URL: 'http://localhost:5173',
    ...options.env,
  });
  let builder = Test.createTestingModule({
    imports: [ApiModule],
    controllers: options.controllers ?? [],
  })
    .overrideProvider(AppConfig)
    .useValue(config);
  if (options.clock !== undefined)
    builder = builder.overrideProvider(Clock).useValue(options.clock);
  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>(HTTP_APP_OPTIONS);
  app.useLogger(app.get(Logger));
  configureHttpApp(app);
  // Listen once, explicitly on 127.0.0.1. Letting supertest call listen(0) per
  // request binds the IPv6 wildcard, and macOS allows that on a port another
  // process already holds on 127.0.0.1; supertest then connects to 127.0.0.1
  // and talks to that process ("Parse Error: Expected HTTP/"). A specific
  // IPv4 bind is always the listener 127.0.0.1 traffic reaches.
  await app.listen(0, '127.0.0.1');
  return app;
}

/** supertest client for an app started by `createTestApp`. */
export function api(app: INestApplication): ReturnType<typeof request> {
  const server = app.getHttpServer() as Server;
  const { address, port } = server.address() as AddressInfo;
  return request(`http://${address}:${port}`);
}
