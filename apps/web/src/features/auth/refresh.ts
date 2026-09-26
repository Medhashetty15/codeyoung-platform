import type { RefreshResponse } from '@app/contracts';

import { API_BASE, REQUESTED_WITH } from '../../shared/api/client';

export type RefreshResult = RefreshResponse;

export const REFRESH_LOCK = 'cy-refresh';

/** Hand-checked instead of zod: this runs on every page load and must stay tiny (PD-24). */
function isRefreshResponse(value: unknown): value is RefreshResponse {
  const body = value as Partial<RefreshResponse> | null;
  return (
    typeof body?.accessToken === 'string' &&
    body.accessToken.length > 0 &&
    typeof body.expiresIn === 'number' &&
    body.expiresIn > 0
  );
}

async function requestRefresh(): Promise<RefreshResponse | null> {
  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { Accept: 'application/json', ...REQUESTED_WITH },
  });
  if (!response.ok) return null;
  const body: unknown = await response.json();
  return isRefreshResponse(body) ? body : null;
}

let inFlight: Promise<RefreshResponse | null> | null = null;

/**
 * Rotates the refresh cookie and returns a new access token (doc 05 §10). Single-flight per tab;
 * across tabs a Web Lock serialises refreshes so a waiting tab uses the cookie the first one just
 * rotated (the server's 20 s grace window covers browsers without Web Locks).
 * A refused refresh resolves to null; a network failure rejects.
 */
export function refreshSession(): Promise<RefreshResponse | null> {
  inFlight ??= (
    'locks' in navigator ? navigator.locks.request(REFRESH_LOCK, requestRefresh) : requestRefresh()
  ).finally(() => {
    inFlight = null;
  });
  return inFlight;
}
