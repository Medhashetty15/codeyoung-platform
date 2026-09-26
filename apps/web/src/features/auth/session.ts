import type { QueryClient } from '@tanstack/react-query';

import { api, configureApiAuth, REQUESTED_WITH } from '../../shared/api/client';

import { refreshSession, type RefreshResult } from './refresh';
import { useSessionStore, type SessionEnd } from './session-store';

/** Refresh this long before the access token expires (doc 05 §10). */
const PROACTIVE_REFRESH_MS = 60_000;
const CHANNEL = 'cy-auth';

type AuthMessage = { type: 'login' } | { type: 'logout' };

interface SessionDeps {
  queryClient: QueryClient;
  /** Router navigation; `replace` for redirects the user did not ask for. */
  navigate: (to: string, options?: { replace?: boolean }) => Promise<void> | void;
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
  useSessionStore.setState({
    status: 'authenticated',
    accessToken: result.accessToken,
    endedBy: null,
  });
  scheduleProactiveRefresh(result.expiresIn);
}

/**
 * Ends the session in this tab. `endedBy` tells guards what happened: after a logout the app goes
 * home by itself; after an expiry protected pages send the parent to log in with a notice.
 */
function clearLocalSession(endedBy: SessionEnd): void {
  clearTimeout(refreshTimer);
  const wasSignedIn = useSessionStore.getState().status === 'authenticated';
  useSessionStore.setState({
    status: 'anonymous',
    accessToken: null,
    endedBy: wasSignedIn ? endedBy : null,
  });
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
  clearLocalSession('expired');
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
  clearLocalSession('logout');
  broadcast({ type: 'logout' });
  await requireDeps().navigate('/', { replace: true });
}

async function onMessage(message: AuthMessage): Promise<void> {
  if (message.type === 'logout') {
    const wasSignedIn = useSessionStore.getState().status === 'authenticated';
    clearLocalSession('logout');
    if (wasSignedIn) await requireDeps().navigate('/', { replace: true });
    return;
  }
  await refreshAccessToken().catch(() => {
    // Another tab signed in while this one is offline; the next request retries.
  });
}

/**
 * Wires the API client to the session, joins the cross-tab channel and starts the silent boot
 * refresh. Public routes render meanwhile; protected routes wait for the status to settle.
 */
export function initSession(sessionDeps: SessionDeps): () => void {
  deps = sessionDeps;
  configureApiAuth({
    getAccessToken: () => useSessionStore.getState().accessToken,
    // A refused refresh ends the session with endedBy 'expired'; RequireAuth takes it from there.
    refresh: refreshAccessToken,
  });
  if ('BroadcastChannel' in window) {
    channel = new BroadcastChannel(CHANNEL);
    channel.addEventListener('message', (event: MessageEvent<AuthMessage>) => {
      void onMessage(event.data);
    });
  }
  refreshAccessToken().catch(() => {
    useSessionStore.setState({ status: 'anonymous', accessToken: null, endedBy: null });
  });
  return () => {
    clearTimeout(refreshTimer);
    channel?.close();
    channel = null;
    configureApiAuth(null);
    deps = null;
  };
}
