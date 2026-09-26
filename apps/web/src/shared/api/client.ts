import type { z } from 'zod';

import { ApiError, toApiError } from './ApiError';

export const API_BASE = '/api/v1';

/** Header the API requires on cookie-authenticated calls (CSRF, doc 03 §6.1). */
export const REQUESTED_WITH = { 'X-Requested-With': 'cy-web' } as const;

/**
 * The auth feature plugs in here at boot, so `shared/` never imports a feature.
 * `refresh` must be single-flight and resolve to the new access token, or null when the session is gone.
 */
export interface ApiAuthAdapter {
  getAccessToken: () => string | null;
  refresh: () => Promise<string | null>;
  onSessionExpired: () => void;
}

let auth: ApiAuthAdapter | null = null;

export function configureApiAuth(adapter: ApiAuthAdapter | null): void {
  auth = adapter;
}

type SchemaMismatchHandler = (path: string, error: z.ZodError) => void;

/** Development throws so contract drift is loud; production reports and keeps going (doc 05 §12.1). */
const defaultMismatchHandler: SchemaMismatchHandler = (path, error) => {
  if (import.meta.env.DEV) {
    throw new ApiError(0, 'INVALID_RESPONSE', `Unexpected response from ${path}`, error.message);
  }
  // Production has no error tracker yet; the console is the report channel.
  // eslint-disable-next-line no-console
  console.error(`Unexpected response from ${path}`, error.issues);
};

let onSchemaMismatch = defaultMismatchHandler;

export function setSchemaMismatchHandler(handler: SchemaMismatchHandler | null): void {
  onSchemaMismatch = handler ?? defaultMismatchHandler;
}

export interface ApiOptions<T> {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  schema?: z.ZodType<T>;
  /** Send the bearer token, and refresh-and-retry once on 401 UNAUTHENTICATED. Default true. */
  auth?: boolean;
  idempotencyKey?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

async function send(
  path: string,
  options: ApiOptions<unknown>,
  token: string | null,
): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.idempotencyKey) headers.set('Idempotency-Key', options.idempotencyKey);
  try {
    return await fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? null : JSON.stringify(options.body),
      credentials: 'same-origin',
      signal: options.signal ?? null,
    });
  } catch (cause) {
    if (options.signal?.aborted) throw cause;
    throw ApiError.network(cause);
  }
}

/** JSON request against /api/v1. Non-2xx responses throw ApiError. */
export async function api<T = void>(path: string, options: ApiOptions<T> = {}): Promise<T> {
  const useAuth = options.auth ?? true;
  let response = await send(path, options, useAuth ? (auth?.getAccessToken() ?? null) : null);

  if (useAuth && auth && response.status === 401) {
    const error = await toApiError(response.clone());
    if (error.code === 'UNAUTHENTICATED') {
      const token = await auth.refresh();
      if (!token) {
        auth.onSessionExpired();
        throw error;
      }
      response = await send(path, options, token);
    }
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204 || !options.schema) return undefined as T;

  const json: unknown = await response.json();
  const parsed = options.schema.safeParse(json);
  if (parsed.success) return parsed.data;
  onSchemaMismatch(path, parsed.error);
  return json as T;
}
