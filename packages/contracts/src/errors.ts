import { z } from 'zod';

/**
 * Stable machine-readable error codes (docs/03-backend-design.md §9).
 * Clients branch on `code` only; `title` and `detail` are human copy and may change.
 */
export const ErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_TIMEZONE: 'INVALID_TIMEZONE',
  SLOT_NOT_ON_GRID: 'SLOT_NOT_ON_GRID',
  WEAK_PASSWORD: 'WEAK_PASSWORD',
  RESET_TOKEN_INVALID: 'RESET_TOKEN_INVALID',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  REFRESH_TOKEN_INVALID: 'REFRESH_TOKEN_INVALID',
  REFRESH_TOKEN_REUSED: 'REFRESH_TOKEN_REUSED',
  NOT_FOUND: 'NOT_FOUND',
  BOOKING_NOT_FOUND: 'BOOKING_NOT_FOUND',
  STUDENT_NOT_FOUND: 'STUDENT_NOT_FOUND',
  CLASSROOM_NOT_FOUND: 'CLASSROOM_NOT_FOUND',
  EMAIL_ALREADY_REGISTERED: 'EMAIL_ALREADY_REGISTERED',
  NO_MENTOR_AVAILABLE: 'NO_MENTOR_AVAILABLE',
  STUDENT_ALREADY_HAS_TRIAL: 'STUDENT_ALREADY_HAS_TRIAL',
  BOOKING_NOT_MODIFIABLE: 'BOOKING_NOT_MODIFIABLE',
  STUDENT_NAME_TAKEN: 'STUDENT_NAME_TAKEN',
  IDEMPOTENCY_KEY_REUSED: 'IDEMPOTENCY_KEY_REUSED',
  SLOT_IN_PAST: 'SLOT_IN_PAST',
  SLOT_OUTSIDE_HORIZON: 'SLOT_OUTSIDE_HORIZON',
  RATE_LIMITED: 'RATE_LIMITED',
  ACCOUNT_TEMPORARILY_LOCKED: 'ACCOUNT_TEMPORARILY_LOCKED',
  TEMPORARILY_UNAVAILABLE: 'TEMPORARILY_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export const ErrorCodeSchema = z.enum(ErrorCode);

/** HTTP status each code is always returned with. */
export const errorCodeStatus = {
  VALIDATION_FAILED: 400,
  INVALID_TIMEZONE: 400,
  SLOT_NOT_ON_GRID: 400,
  WEAK_PASSWORD: 400,
  RESET_TOKEN_INVALID: 400,
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  REFRESH_TOKEN_INVALID: 401,
  REFRESH_TOKEN_REUSED: 401,
  NOT_FOUND: 404,
  BOOKING_NOT_FOUND: 404,
  STUDENT_NOT_FOUND: 404,
  CLASSROOM_NOT_FOUND: 404,
  EMAIL_ALREADY_REGISTERED: 409,
  NO_MENTOR_AVAILABLE: 409,
  STUDENT_ALREADY_HAS_TRIAL: 409,
  BOOKING_NOT_MODIFIABLE: 409,
  STUDENT_NAME_TAKEN: 409,
  IDEMPOTENCY_KEY_REUSED: 422,
  SLOT_IN_PAST: 422,
  SLOT_OUTSIDE_HORIZON: 422,
  RATE_LIMITED: 429,
  ACCOUNT_TEMPORARILY_LOCKED: 429,
  TEMPORARILY_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
} as const satisfies Record<ErrorCode, number>;

/** Stable, human-readable `title` per code. Clients branch on `code`, never on this text. */
export const errorTitles = {
  VALIDATION_FAILED: 'The request is not valid',
  INVALID_TIMEZONE: 'Unknown time zone',
  SLOT_NOT_ON_GRID: 'The start time is not a bookable slot',
  WEAK_PASSWORD: 'The password does not meet the policy',
  RESET_TOKEN_INVALID: 'The reset link is invalid or has expired',
  UNAUTHENTICATED: 'Authentication is required',
  INVALID_CREDENTIALS: 'Email or password is incorrect',
  REFRESH_TOKEN_INVALID: 'The session has expired',
  REFRESH_TOKEN_REUSED: 'The session was revoked',
  NOT_FOUND: 'Resource not found',
  BOOKING_NOT_FOUND: 'Booking not found',
  STUDENT_NOT_FOUND: 'Student not found',
  CLASSROOM_NOT_FOUND: 'Class link not found',
  EMAIL_ALREADY_REGISTERED: 'An account with this email already exists',
  NO_MENTOR_AVAILABLE: 'No mentor is available for this time',
  STUDENT_ALREADY_HAS_TRIAL: 'This student already has an upcoming trial',
  BOOKING_NOT_MODIFIABLE: 'This booking can no longer be changed',
  STUDENT_NAME_TAKEN: 'A student with this name already exists',
  IDEMPOTENCY_KEY_REUSED: 'The idempotency key was used for a different request',
  SLOT_IN_PAST: 'The time is too soon to book',
  SLOT_OUTSIDE_HORIZON: 'The time is too far ahead to book',
  RATE_LIMITED: 'Too many requests',
  ACCOUNT_TEMPORARILY_LOCKED: 'The account is temporarily locked',
  TEMPORARILY_UNAVAILABLE: 'The service is temporarily unavailable',
  INTERNAL_ERROR: 'Something went wrong',
} as const satisfies Record<ErrorCode, string>;

/** Base URI for the RFC 7807 `type` member; the code is appended in kebab case. */
export const ERROR_TYPE_BASE_URI = 'https://errors.codeyoung.dev/';

export function errorTypeUri(code: ErrorCode): string {
  return ERROR_TYPE_BASE_URI + code.toLowerCase().replaceAll('_', '-');
}

/** One invalid request field; `path` is dotted request field names, e.g. `student.firstName`. */
export const FieldErrorSchema = z.object({
  path: z.string(),
  message: z.string(),
});
export type FieldError = z.infer<typeof FieldErrorSchema>;

/**
 * Members every error response carries (`Content-Type: application/problem+json`).
 * `ProblemSchema` (problems.ts) adds the code-specific members.
 */
export const ProblemDetailsSchema = z.looseObject({
  type: z.string(),
  title: z.string(),
  status: z.int(),
  code: ErrorCodeSchema,
  detail: z.string().optional(),
  traceId: z.string(),
  errors: z.array(FieldErrorSchema).optional(),
  /** Seconds to wait before retrying; mirrors `Retry-After` on 429 and 503. */
  retryAfterSeconds: z.int().nonnegative().optional(),
});
export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>;

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';
