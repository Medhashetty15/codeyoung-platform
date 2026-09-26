import { z } from 'zod';

import { API_BASE, REQUESTED_WITH } from '../../shared/api/client';

const refreshResponseSchema = z.object({
  accessToken: z.string().min(1),
  expiresIn: z.number().int().positive(),
});
export type RefreshResult = z.infer<typeof refreshResponseSchema>;

export const REFRESH_LOCK = 'cy-refresh';

async function requestRefresh(): Promise<RefreshResult | null> {
  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { Accept: 'application/json', ...REQUESTED_WITH },
  });
  if (!response.ok) return null;
  const parsed = refreshResponseSchema.safeParse(await response.json());
  return parsed.success ? parsed.data : null;
}

let inFlight: Promise<RefreshResult | null> | null = null;

/**
 * Rotates the refresh cookie and returns a new access token (doc 05 §10). Single-flight per tab;
 * across tabs a Web Lock serialises refreshes so a waiting tab uses the cookie the first one just
 * rotated (the server's 20 s grace window covers browsers without Web Locks).
 * A refused refresh resolves to null; a network failure rejects.
 */
export function refreshSession(): Promise<RefreshResult | null> {
  inFlight ??= (
    'locks' in navigator ? navigator.locks.request(REFRESH_LOCK, requestRefresh) : requestRefresh()
  ).finally(() => {
    inFlight = null;
  });
  return inFlight;
}
