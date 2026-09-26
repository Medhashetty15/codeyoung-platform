import type { z } from 'zod';

import { ApiError, toApiError } from './ApiError';

export const API_BASE = '/api/v1';

/** Header the API requires on cookie-authenticated calls (CSRF, doc 03 §6.1). */
export const REQUESTED_WITH = { 'X-Requested-With': 'cy-web' } as const;

/**
 * The auth feature plugs in here at boot, so `shared/` never imports a feature.
 * `refresh` must be single-flight and resolve to the new access token, or null when the session is
 * gone (the auth feature then ends the session itself).
 */
export interface ApiAuthAdapter {
  getAccessToken: () => string | null;
  refresh: () => Promise<string | null>;
}

let auth: ApiAuthAdapter | null = null;

export function configureApiAuth(adapter: ApiAuthAdapter | null): void {
  auth = adapter;
}

type SchemaMismatchHandler = (path: string, error: z.ZodError) => void;

/** Contract drift is loud where schemas exist: development and tests (doc 05 §12.1). */
const defaultMismatchHandler: SchemaMismatchHandler = (path, error) => {
  throw new ApiError(0, 'INVALID_RESPONSE', `Unexpected response from ${path}`, error.message);
};

let onSchemaMismatch = defaultMismatchHandler;

export function setSchemaMismatchHandler(handler: SchemaMismatchHandler | null): void {
  onSchemaMismatch = handler ?? defaultMismatchHandler;
}

export interface ApiOptions<T> {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /**
   * Response schema, checked in development and tests only (PD-24). Pass it as
   * `import.meta.env.DEV ? XSchema : undefined` so production builds drop the schema and zod.
   */
  schema?: z.ZodType<T> | undefined;
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

/** Sends the request with auth, refreshing once on 401 UNAUTHENTICATED; throws ApiError on non-2xx. */
async function request(path: string, options: ApiOptions<unknown>): Promise<Response> {
  const useAuth = options.auth ?? true;
  let response = await send(path, options, useAuth ? (auth?.getAccessToken() ?? null) : null);

  if (useAuth && auth && response.status === 401) {
    const error = await toApiError(response.clone());
    if (error.code === 'UNAUTHENTICATED') {
      const token = await auth.refresh();
      if (!token) throw error;
      response = await send(path, options, token);
    }
  }

  if (!response.ok) throw await toApiError(response);
  return response;
}

/** JSON request against /api/v1. Non-2xx responses throw ApiError; empty bodies resolve to undefined. */
export async function api<T = void>(path: string, options: ApiOptions<T> = {}): Promise<T> {
  const response = await request(path, options);
  // 202 (forgot password) and 204 carry no body.
  const text = await response.text();
  if (!text) return undefined as T;
  const json: unknown = JSON.parse(text);
  if (!options.schema) return json as T;

  const parsed = options.schema.safeParse(json);
  if (parsed.success) return parsed.data;
  onSchemaMismatch(path, parsed.error);
  return json as T;
}

/** A file from the API (e.g. the .ics invite), fetched with the bearer token like any call. */
export async function apiBlob(
  path: string,
  options: Omit<ApiOptions<Blob>, 'schema'> = {},
): Promise<Blob> {
  const response = await request(path, options);
  return response.blob();
}
