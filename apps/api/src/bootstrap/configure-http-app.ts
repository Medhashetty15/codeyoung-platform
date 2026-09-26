import { type NestApplicationOptions } from '@nestjs/common';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { cleanupOpenApiDoc } from 'nestjs-zod';

import { jsonBodyParser, translateBodyErrors } from '../common/http/json-body';
import { REQUEST_ID_HEADER, requestIdMiddleware } from '../common/http/request-id';
import { AppConfig } from '../config/app-config';

export const API_PREFIX = 'api/v1';

/** Options for `NestFactory.create`, shared by `main.ts` and the e2e tests. */
export const HTTP_APP_OPTIONS = {
  bodyParser: false,
  bufferLogs: true,
  abortOnError: false,
} as const satisfies NestApplicationOptions;
export const DOCS_PATH = 'api/docs';

const ALLOWED_HEADERS = [
  'Authorization',
  'Content-Type',
  'Idempotency-Key',
  'X-Requested-With',
  REQUEST_ID_HEADER,
];
const EXPOSED_HEADERS = ['Retry-After', 'Content-Disposition', REQUEST_ID_HEADER];

/**
 * HTTP pipeline shared by `main.ts` and the e2e tests, so tests exercise the
 * exact production middleware order (docs/03 §1 request pipeline).
 */
export function configureHttpApp(app: NestExpressApplication): void {
  const config = app.get(AppConfig);

  app.set('trust proxy', config.trustProxyHops);
  app.use(requestIdMiddleware);
  app.use(helmet());
  // Nest's own parser is disabled (HTTP_APP_OPTIONS) so limits and error details are ours.
  app.use(jsonBodyParser(), translateBodyErrors);
  app.enableCors({
    origin: [...config.corsOrigins],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ALLOWED_HEADERS,
    exposedHeaders: EXPOSED_HEADERS,
    maxAge: 600,
  });
  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();

  if (!config.isProduction) setUpSwagger(app);
}

function setUpSwagger(app: NestExpressApplication): void {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Codeyoung Trial Booking API')
      .setDescription('Errors are RFC 7807 application/problem+json with a stable `code`.')
      .setVersion('1')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup(DOCS_PATH, app, cleanupOpenApiDoc(document));
}
