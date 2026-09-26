import { type IncomingMessage, type ServerResponse } from 'node:http';

import { type DynamicModule, Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule, type Params } from 'nestjs-pino';
import { type Options } from 'pino-http';

import { AppConfig } from '../../config/app-config';
import { assignRequestId } from '../http/request-id';

import { censor, REDACTED_PATHS, redactUrl } from './redaction';

export type LogDestination = 'stdout' | 'stderr';

const HEALTH_PATH = /^\/api\/v1\/health\//;

function buildLoggerParams(config: AppConfig, destination: LogDestination): Params {
  const fd = destination === 'stdout' ? 1 : 2;
  const pinoHttp: Options = {
    level: config.logLevel,
    redact: { paths: REDACTED_PATHS, censor },
    genReqId: (req: IncomingMessage, res: ServerResponse) => assignRequestId(req, res),
    serializers: {
      req: (req: { id: unknown; method: string; url: string }) => ({
        id: req.id,
        method: req.method,
        url: redactUrl(req.url),
      }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
    customLogLevel: (_req, res, err) => {
      if (err !== undefined || res.statusCode >= 500) return 'error';
      return res.statusCode >= 400 ? 'warn' : 'info';
    },
    // Probes hit health endpoints every few seconds; logging them only adds noise.
    autoLogging: { ignore: (req) => HEALTH_PATH.test(req.url ?? '') },
    ...(config.logPretty
      ? { transport: { target: 'pino-pretty', options: { destination: fd, singleLine: true } } }
      : {}),
  };
  return config.logPretty ? { pinoHttp } : { pinoHttp: [pinoHttp, destinationStream(fd)] };
}

function destinationStream(fd: 1 | 2): NodeJS.WritableStream {
  return fd === 1 ? process.stdout : process.stderr;
}

/** Structured JSON logging with request ids and PII redaction (docs/02 §5). */
@Module({})
export class LoggerModule {
  static forRoot(destination: LogDestination = 'stdout'): DynamicModule {
    return {
      module: LoggerModule,
      imports: [
        PinoLoggerModule.forRootAsync({
          inject: [AppConfig],
          useFactory: (config: AppConfig) => buildLoggerParams(config, destination),
        }),
      ],
      exports: [PinoLoggerModule],
    };
  }
}
