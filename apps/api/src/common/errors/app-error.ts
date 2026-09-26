import { type ErrorCode } from '@app/contracts';

export interface AppErrorOptions {
  /** Client-facing explanation specific to this occurrence (problem `detail`). */
  detail?: string;
  /** Code-specific members added to the problem body (e.g. `alternatives`, `bookingId`). */
  extras?: Record<string, unknown>;
  /** Extra response headers (e.g. `Retry-After`). */
  headers?: Record<string, string>;
  cause?: unknown;
}

/**
 * Base for every expected, client-facing failure. The problem-details filter
 * turns it into an RFC 7807 response with the documented status for `code`.
 */
export class AppError extends Error {
  override readonly name: string = 'AppError';
  readonly detail: string | undefined;
  readonly extras: Readonly<Record<string, unknown>>;
  readonly headers: Readonly<Record<string, string>>;

  constructor(
    readonly code: ErrorCode,
    options: AppErrorOptions = {},
  ) {
    super(options.detail ?? code, { cause: options.cause });
    this.detail = options.detail;
    this.extras = options.extras ?? {};
    this.headers = options.headers ?? {};
  }
}
