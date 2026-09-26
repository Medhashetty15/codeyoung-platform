import type { QueryClient } from '@tanstack/react-query';

import { api, configureApiAuth, REQUESTED_WITH } from '../../shared/api/client';

import { refreshSession, type RefreshResult } from './refresh';
import { loginPathFor } from './return-to';
import { useSessionStore } from './session-store';

/** Refresh this long before the access token expires (doc 05 §10). */
const PROACTIVE_REFRESH_MS = 60_000;
const CHANNEL = 'cy-auth';

type AuthMessage = { type: 'login' } | { type: 'logout' };

interface SessionDeps {
  queryClient: QueryClient;
  /** Router navigation; `replace` for redirects the user did not ask for. */
  navigate: (to: string, options?: { replace?: boolean; state?: unknown }) => void;
  currentPath: () => string;
}

let deps: SessionDeps | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let channel: BroadcastChannel | null = null;

function requireDeps(): SessionDeps {
  if (!deps) throw new Error('Session used before initSession()');
  return deps;
}

function broadcast(message: AuthMessage): void {
  channel?.postMessage(message);
}

function scheduleProactiveRefresh(expiresInSeconds: number): void {
  clearTimeout(refreshTimer);
  const delay = Math.max(0, expiresInSeconds * 1000 - PROACTIVE_REFRESH_MS);
  refreshTimer = setTimeout(() => {
    void refreshAccessToken().catch(() => {
      // Offline: the next API call refreshes reactively on its 401.
    });
  }, delay);
}

/** Stores a fresh access token (after login, register or refresh) and plans the next refresh. */
export function startSession(result: RefreshResult): void {
  useSessionStore.setState({ status: 'authenticated', accessToken: result.accessToken });
  scheduleProactiveRefresh(result.expiresIn);
}

function clearLocalSession(): void {
  clearTimeout(refreshTimer);
  useSessionStore.setState({ status: 'anonymous', accessToken: null });
  // Nothing from the previous user may survive into the next one (doc 05 §1 goal 6).
  deps?.queryClient.clear();
}

/** Single-flight refresh. Resolves to the new token, or null when the server ended the session. */
export async function refreshAccessToken(): Promise<string | null> {
  const result = await refreshSession();
  if (result) {
    startSession(result);
    return result.accessToken;
  }
  clearLocalSession();
  return null;
}

/** Called after a successful login or registration in this tab. */
export function signedIn(result: RefreshResult): void {
  startSession(result);
  broadcast({ type: 'login' });
}

export async function logout(): Promise<void> {
  try {
    await api('/auth/logout', { method: 'POST', auth: false, headers: REQUESTED_WITH });
  } catch {
    // Logout is idempotent server-side; the local session ends regardless.
  }
  clearLocalSession();
  broadcast({ type: 'logout' });
  requireDeps().navigate('/', { replace: true });
}

/** The refresh token is gone mid-visit: back to login with a notice, returning here afterwards. */
function sessionExpired(): void {
  const { navigate, currentPath } = requireDeps();
  clearLocalSession();
  navigate(loginPathFor(currentPath()), { replace: true, state: { notice: 'session-expired' } });
}

function onMessage(event: MessageEvent<AuthMessage>): void {
  if (event.data.type === 'logout') {
    const wasSignedIn = useSessionStore.getState().status === 'authenticated';
    clearLocalSession();
    if (wasSignedIn) requireDeps().navigate('/', { replace: true });
  } else {
    void refreshAccessToken().catch(() => {
      // Another tab signed in while this one is offline; the next request retries.
    });
  }
}

/**
 * Wires the API client to the session, joins the cross-tab channel and starts the silent boot
 * refresh. Public routes render meanwhile; protected routes wait for the status to settle.
 */
export function initSession(sessionDeps: SessionDeps): () => void {
  deps = sessionDeps;
  configureApiAuth({
    getAccessToken: () => useSessionStore.getState().accessToken,
    refresh: refreshAccessToken,
    onSessionExpired: sessionExpired,
  });
  if ('BroadcastChannel' in window) {
    channel = new BroadcastChannel(CHANNEL);
    channel.addEventListener('message', onMessage);
  }
  refreshAccessToken().catch(() => {
    useSessionStore.setState({ status: 'anonymous', accessToken: null });
  });
  return () => {
    clearTimeout(refreshTimer);
    channel?.close();
    channel = null;
    configureApiAuth(null);
    deps = null;
  };
}
