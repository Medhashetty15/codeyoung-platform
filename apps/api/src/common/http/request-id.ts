import { randomUUID } from 'node:crypto';
import { type IncomingMessage, type ServerResponse } from 'node:http';

export const REQUEST_ID_HEADER = 'X-Request-Id';

// Accept upstream ids (reverse proxy, web client) only when they are safe to log verbatim.
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{8,128}$/;

type WithId = IncomingMessage & { id?: unknown };

/** Reuses a well-formed incoming `X-Request-Id`, otherwise mints a UUID. */
export function resolveRequestId(incoming: string | string[] | undefined): string {
  return typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
}

/**
 * Assigns `req.id` once per request and echoes it as `X-Request-Id`. Idempotent,
 * so the early middleware and pino-http's `genReqId` always agree on the id.
 */
export function assignRequestId(request: IncomingMessage, response: ServerResponse): string {
  const existing = (request as WithId).id;
  if (typeof existing === 'string') return existing;
  const id = resolveRequestId(request.headers['x-request-id']);
  (request as WithId).id = id;
  response.setHeader(REQUEST_ID_HEADER, id);
  return id;
}

/**
 * Express middleware registered before the body parser, so even requests that
 * fail while parsing carry a `traceId` that matches the response header.
 */
export function requestIdMiddleware(
  request: IncomingMessage,
  response: ServerResponse,
  next: () => void,
): void {
  assignRequestId(request, response);
  next();
}

/** The id assigned to this request (also returned to clients as `traceId`). */
export function requestIdOf(request: IncomingMessage): string {
  const { id } = request as WithId;
  return typeof id === 'string' ? id : 'unknown';
}
