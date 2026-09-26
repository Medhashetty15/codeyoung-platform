import { HttpException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { ZodValidationException } from 'nestjs-zod';
import { type core } from 'zod';

import { ErrorCode, errorCodeStatus, type FieldError } from '@app/contracts';

import { AppError } from './app-error';

const UNAUTHORIZED = 401;
const FORBIDDEN = 403;
const NOT_FOUND = 404;
const TOO_MANY_REQUESTS = 429;
const SERVICE_UNAVAILABLE = 503;

/** Seconds a client should wait after a 503 when no better estimate exists. */
const DEFAULT_RETRY_AFTER_SECONDS = 5;

export interface MappedProblem {
  code: ErrorCode;
  status: number;
  detail?: string;
  extras: Record<string, unknown>;
  headers: Record<string, string>;
  /** True when the failure is ours (5xx) and must be logged with its stack. */
  unexpected: boolean;
}

/**
 * Translates any thrown value into the problem it should be reported as.
 * Pure: no logging, no response writing.
 */
export function mapException(exception: unknown): MappedProblem {
  if (exception instanceof AppError) {
    return problem(exception.code, {
      detail: exception.detail,
      extras: { ...exception.extras },
      headers: { ...exception.headers },
    });
  }
  if (exception instanceof ZodValidationException) {
    const error = exception.getZodError();
    const invalidZone = hasIssueCode(error, ErrorCode.INVALID_TIMEZONE);
    return problem(invalidZone ? ErrorCode.INVALID_TIMEZONE : ErrorCode.VALIDATION_FAILED, {
      detail: invalidZone
        ? 'The time zone is not a known IANA zone.'
        : 'One or more fields are invalid.',
      extras: { errors: fieldErrors(error) },
    });
  }
  if (exception instanceof ThrottlerException) {
    return problem(ErrorCode.RATE_LIMITED, { detail: 'Please wait before trying again.' });
  }
  if (exception instanceof HttpException) {
    return fromHttpStatus(exception.getStatus(), exception.message);
  }
  return { ...problem(ErrorCode.INTERNAL_ERROR), unexpected: true };
}

function fromHttpStatus(status: number, message: string): MappedProblem {
  if (status >= 500) {
    if (status === SERVICE_UNAVAILABLE) {
      return problem(ErrorCode.TEMPORARILY_UNAVAILABLE, {
        headers: { 'Retry-After': String(DEFAULT_RETRY_AFTER_SECONDS) },
      });
    }
    return { ...problem(ErrorCode.INTERNAL_ERROR), unexpected: true };
  }
  switch (status) {
    case UNAUTHORIZED:
      return problem(ErrorCode.UNAUTHENTICATED);
    // 403 is reported as 404 so callers cannot probe for resources they do not own.
    case FORBIDDEN:
    case NOT_FOUND:
      return problem(ErrorCode.NOT_FOUND);
    case TOO_MANY_REQUESTS:
      return problem(ErrorCode.RATE_LIMITED);
    default:
      // Any other client error (bad JSON, 413, 415, pipe failures) is an invalid request.
      return problem(ErrorCode.VALIDATION_FAILED, { detail: message });
  }
}

function problem(
  code: ErrorCode,
  parts: Partial<Pick<MappedProblem, 'detail' | 'extras' | 'headers'>> = {},
): MappedProblem {
  return {
    code,
    status: errorCodeStatus[code],
    ...(parts.detail === undefined ? {} : { detail: parts.detail }),
    extras: parts.extras ?? {},
    headers: parts.headers ?? {},
    unexpected: false,
  };
}

/** Flattens zod issues to `{ path: "student.firstName", message }` (FE maps paths to fields). */
export function fieldErrors(error: unknown): FieldError[] {
  if (!isZodError(error)) return [];
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    message: issue.message,
  }));
}

/**
 * True when a schema marked one of the issues with its own error code
 * (`params: { code }`, e.g. IanaZoneSchema -> INVALID_TIMEZONE).
 */
function hasIssueCode(error: unknown, code: ErrorCode): boolean {
  if (!isZodError(error)) return false;
  return error.issues.some(
    (issue) =>
      issue.code === 'custom' && (issue.params as { code?: unknown } | undefined)?.code === code,
  );
}

// Duck-typed so errors from any zod entry point (classic, mini, core) are recognised.
function isZodError(error: unknown): error is core.$ZodError {
  return (
    typeof error === 'object' &&
    error !== null &&
    Array.isArray((error as { issues?: unknown }).issues)
  );
}
