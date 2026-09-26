import { type ArgumentsHost, Catch, type ExceptionFilter, Logger } from '@nestjs/common';
import { type Request, type Response } from 'express';

import {
  errorTitles,
  errorTypeUri,
  PROBLEM_CONTENT_TYPE,
  type ProblemDetails,
} from '@app/contracts';

import { requestIdOf } from '../http/request-id';
import { redactUrl } from '../logging/redaction';

import { mapException, type MappedProblem } from './map-exception';

/**
 * Single exit point for every HTTP error: RFC 7807 `application/problem+json`
 * with a stable `code` and the request id as `traceId` (docs/03 §9).
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const mapped = mapException(exception);
    const traceId = requestIdOf(request);

    if (mapped.unexpected) {
      this.logger.error({ err: exception, traceId }, 'Unhandled error while serving request');
    } else if (!reachedRequestLogger(request)) {
      // Failed before the request logger ran (e.g. body parsing), so nothing else logs it.
      this.logger.warn(
        {
          traceId,
          method: request.method,
          url: redactUrl(request.originalUrl),
          status: mapped.status,
        },
        'Request rejected before routing',
      );
    }
    if (response.headersSent) return;

    for (const [name, value] of Object.entries(mapped.headers)) response.setHeader(name, value);
    if (mapped.code === 'RATE_LIMITED') copyThrottlerRetryAfter(response);

    response
      .status(mapped.status)
      .setHeader('Cache-Control', 'no-store')
      .type(PROBLEM_CONTENT_TYPE)
      .send(JSON.stringify(toBody(mapped, traceId, retryAfterSeconds(response))));
  }
}

// pino-http attaches `req.log`; its typings claim it always exists, so check at runtime.
function reachedRequestLogger(request: Request): boolean {
  return (request as { log?: unknown }).log !== undefined;
}

export function toBody(
  mapped: MappedProblem,
  traceId: string,
  retryAfter?: number,
): ProblemDetails {
  return {
    // Extras first so they can never overwrite the standard members.
    ...mapped.extras,
    type: errorTypeUri(mapped.code),
    title: errorTitles[mapped.code],
    status: mapped.status,
    code: mapped.code,
    ...(mapped.detail === undefined ? {} : { detail: mapped.detail }),
    traceId,
    ...(retryAfter === undefined ? {} : { retryAfterSeconds: retryAfter }),
  };
}

/** Mirrors `Retry-After` (seconds) into the body so clients need not read headers. */
function retryAfterSeconds(response: Response): number | undefined {
  const value = Number(response.getHeader('Retry-After'));
  return Number.isInteger(value) && value >= 0 ? value : undefined;
}

/**
 * @nestjs/throttler names the header `Retry-After-<throttler>` for named
 * throttlers. Clients only read the standard header, so expose the longest wait.
 */
function copyThrottlerRetryAfter(response: Response): void {
  if (response.hasHeader('Retry-After')) return;
  const waits = Object.entries(response.getHeaders())
    .filter(([name]) => name.startsWith('retry-after-'))
    .map(([, value]) => Number(value))
    .filter((value) => Number.isFinite(value));
  if (waits.length > 0) response.setHeader('Retry-After', String(Math.max(...waits)));
}
