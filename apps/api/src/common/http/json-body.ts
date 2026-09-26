import { type ErrorRequestHandler, json, type RequestHandler } from 'express';

import { ErrorCode } from '@app/contracts';

import { AppError } from '../errors/app-error';

/** Largest JSON body the API accepts; every documented request is far smaller. */
const JSON_BODY_LIMIT = '100kb';

const BODY_ERROR_DETAILS: Record<string, string> = {
  'entity.parse.failed': 'The request body is not valid JSON.',
  'entity.too.large': 'The request body is too large.',
  'encoding.unsupported': 'The request body encoding is not supported.',
  'charset.unsupported': 'The request body charset is not supported.',
  'request.aborted': 'The request body was not received completely.',
  'request.size.invalid': 'The request body size does not match its Content-Length.',
};

export function jsonBodyParser(): RequestHandler {
  return json({ limit: JSON_BODY_LIMIT });
}

/**
 * Turns body-parser failures into VALIDATION_FAILED with a fixed detail. The
 * parser's own message echoes request content, so it never reaches the client.
 */
export const translateBodyErrors: ErrorRequestHandler = (error: unknown, _req, _res, next) => {
  const type =
    typeof error === 'object' && error !== null ? (error as { type?: unknown }).type : undefined;
  const detail = typeof type === 'string' ? BODY_ERROR_DETAILS[type] : undefined;
  next(
    detail === undefined
      ? error
      : new AppError(ErrorCode.VALIDATION_FAILED, { detail, cause: error }),
  );
};
