import type { ErrorCode, FieldError } from '@app/contracts';

/** Codes the client produces itself, next to the API's documented codes (doc 03 §9). */
export type ClientErrorCode = 'NETWORK_ERROR' | 'INVALID_RESPONSE' | 'UNKNOWN_ERROR';

export type ApiErrorCode = ErrorCode | ClientErrorCode;

/** Any non-2xx response or transport failure. UI branches on `code` only (doc 05 §12.1). */
export class ApiError extends Error {
  override readonly name = 'ApiError';

  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    readonly title: string,
    readonly detail?: string,
    readonly errors: FieldError[] = [],
    /** Seconds from the Retry-After header, when present. */
    readonly retryAfter?: number,
    readonly traceId?: string,
    /** Code-specific members of the problem document (alternatives, bookingId, reason, reasons). */
    readonly extras: Record<string, unknown> = {},
  ) {
    super(`${String(status)} ${code}: ${title}`);
  }

  static network(cause: unknown): ApiError {
    const error = new ApiError(0, 'NETWORK_ERROR', 'Network request failed');
    error.cause = cause;
    return error;
  }

  /** Short reference for support, e.g. "7F3A-91C2", from the first 8 hex digits of the trace id. */
  get reference(): string | undefined {
    const hex = this.traceId
      ?.replace(/[^0-9a-f]/gi, '')
      .slice(0, 8)
      .toUpperCase();
    return hex?.length === 8 ? `${hex.slice(0, 4)}-${hex.slice(4)}` : undefined;
  }
}

export function isApiError(error: unknown, code?: ApiErrorCode): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code);
}

/** The API always sends Retry-After as delay-seconds (doc 03 §9); an HTTP-date is ignored. */
export function parseRetryAfter(header: string | null): number | undefined {
  if (!header?.trim()) return undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds) ? Math.max(0, Math.ceil(seconds)) : undefined;
}

const KNOWN_MEMBERS = new Set([
  'type',
  'title',
  'status',
  'code',
  'detail',
  'errors',
  'traceId',
  'instance',
]);

function fallbackCode(status: number): ApiErrorCode {
  if (status === 503) return 'TEMPORARILY_UNAVAILABLE';
  if (status >= 500) return 'INTERNAL_ERROR';
  if (status === 404) return 'NOT_FOUND';
  if (status === 429) return 'RATE_LIMITED';
  return 'UNKNOWN_ERROR';
}

/** Reads an RFC 7807 problem document; proxies that answer with HTML fall back to the status. */
export async function toApiError(response: Response): Promise<ApiError> {
  let body: Record<string, unknown> = {};
  try {
    const parsed: unknown = await response.json();
    if (parsed !== null && typeof parsed === 'object') body = parsed as Record<string, unknown>;
  } catch {
    // Not JSON: keep the empty body and derive everything from the status line.
  }
  const text = (value: unknown) => (typeof value === 'string' ? value : undefined);
  const errors = Array.isArray(body.errors)
    ? body.errors.filter(
        (entry): entry is FieldError =>
          typeof (entry as Partial<FieldError> | null)?.path === 'string' &&
          typeof (entry as Partial<FieldError> | null)?.message === 'string',
      )
    : [];
  const extras = Object.fromEntries(
    Object.entries(body).filter(([key]) => !KNOWN_MEMBERS.has(key)),
  );
  return new ApiError(
    response.status,
    // Typed pass-through (PD-24): the API only sends documented codes; UI branches on known ones.
    typeof body.code === 'string' ? (body.code as ErrorCode) : fallbackCode(response.status),
    text(body.title) ?? response.statusText,
    text(body.detail),
    errors,
    parseRetryAfter(response.headers.get('Retry-After')),
    text(body.traceId),
    extras,
  );
}
