import { QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

import { api } from '../../shared/api/client';
import { problem, server } from '../../test/msw';

import { refreshSession } from './refresh';
import { initSession, logout, signedIn } from './session';
import { useSessionStore } from './session-store';

const refreshOk = (token = 'fresh') =>
  http.post('/api/v1/auth/refresh', () =>
    HttpResponse.json({ accessToken: token, expiresIn: 900 }),
  );

let stop: () => void;
let clearCache: MockInstance<QueryClient['clear']>;
const navigate = vi.fn();

async function boot(path = '/bookings') {
  const queryClient = new QueryClient();
  clearCache = vi.spyOn(queryClient, 'clear');
  stop = initSession({ queryClient, navigate, currentPath: () => path });
  await vi.waitFor(() => {
    expect(useSessionStore.getState().status).not.toBe('unknown');
  });
}

beforeEach(() => {
  navigate.mockReset();
  useSessionStore.setState({ status: 'unknown', accessToken: null });
});
afterEach(() => {
  stop();
  vi.useRealTimers();
});

describe('session boot', () => {
  it('becomes authenticated when the refresh cookie is valid', async () => {
    server.use(refreshOk());
    await boot();
    expect(useSessionStore.getState()).toMatchObject({
      status: 'authenticated',
      accessToken: 'fresh',
    });
  });

  it('becomes anonymous when there is no session', async () => {
    server.use(http.post('/api/v1/auth/refresh', () => problem(401, 'REFRESH_TOKEN_INVALID')));
    await boot();
    expect(useSessionStore.getState()).toMatchObject({ status: 'anonymous', accessToken: null });
  });

  it('becomes anonymous when the API is unreachable', async () => {
    server.use(http.post('/api/v1/auth/refresh', () => HttpResponse.error()));
    await boot();
    expect(useSessionStore.getState().status).toBe('anonymous');
  });
});

describe('refreshSession', () => {
  it('shares one request between concurrent callers', async () => {
    const handler = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return HttpResponse.json({ accessToken: 'fresh', expiresIn: 900 });
    });
    server.use(http.post('/api/v1/auth/refresh', handler));
    const results = await Promise.all([refreshSession(), refreshSession(), refreshSession()]);
    expect(results.map((r) => r?.accessToken)).toEqual(['fresh', 'fresh', 'fresh']);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('sends the CSRF header', async () => {
    let header: string | null = null;
    server.use(
      http.post('/api/v1/auth/refresh', ({ request }) => {
        header = request.headers.get('X-Requested-With');
        return HttpResponse.json({ accessToken: 'fresh', expiresIn: 900 });
      }),
    );
    await refreshSession();
    expect(header).toBe('cy-web');
  });
});

describe('session lifecycle', () => {
  it('refreshes proactively a minute before the access token expires', async () => {
    server.use(refreshOk('first'));
    await boot();
    vi.useFakeTimers();
    server.use(refreshOk('second'));
    signedIn({ accessToken: 'first', expiresIn: 120 });
    await vi.advanceTimersByTimeAsync(59_000);
    expect(useSessionStore.getState().accessToken).toBe('first');
    await vi.advanceTimersByTimeAsync(2_000);
    expect(useSessionStore.getState().accessToken).toBe('second');
  });

  it('logs out: tells the API, clears cached data and goes home', async () => {
    server.use(refreshOk());
    await boot();
    const logoutCall = vi.fn(({ request }: { request: Request }) => {
      expect(request.headers.get('X-Requested-With')).toBe('cy-web');
      return new HttpResponse(null, { status: 204 });
    });
    server.use(http.post('/api/v1/auth/logout', logoutCall));
    await logout();
    expect(logoutCall).toHaveBeenCalledOnce();
    expect(useSessionStore.getState().status).toBe('anonymous');
    expect(clearCache).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('sends the parent to log in, with a way back, when the session dies mid-visit', async () => {
    server.use(refreshOk());
    await boot('/bookings?scope=past');
    server.use(
      http.get('/api/v1/me', () => problem(401, 'UNAUTHENTICATED')),
      http.post('/api/v1/auth/refresh', () => problem(401, 'REFRESH_TOKEN_REUSED')),
    );
    await expect(api('/me')).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(useSessionStore.getState().status).toBe('anonymous');
    expect(navigate).toHaveBeenCalledWith('/login?returnTo=%2Fbookings%3Fscope%3Dpast', {
      replace: true,
      state: { notice: 'session-expired' },
    });
  });

  it('follows a logout from another tab', async () => {
    server.use(refreshOk());
    await boot();
    const otherTab = new BroadcastChannel('cy-auth');
    otherTab.postMessage({ type: 'logout' });
    await vi.waitFor(() => {
      expect(useSessionStore.getState().status).toBe('anonymous');
    });
    expect(navigate).toHaveBeenCalledWith('/', { replace: true });
    otherTab.close();
  });
});
