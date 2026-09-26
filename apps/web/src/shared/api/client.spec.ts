import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { problem, server } from '../../test/msw';

import { ApiError, parseRetryAfter } from './ApiError';
import { api, configureApiAuth } from './client';

const meSchema = z.object({ id: z.string(), fullName: z.string() });

let token: string | null;
const refresh = vi.fn<() => Promise<string | null>>();
const onSessionExpired = vi.fn();

beforeEach(() => {
  token = 'expired';
  refresh.mockReset().mockImplementation(() => {
    token = 'fresh';
    return Promise.resolve(token);
  });
  onSessionExpired.mockReset();
  configureApiAuth({ getAccessToken: () => token, refresh, onSessionExpired });
});

/** Accepts only the token "fresh". */
const protectedMe = () =>
  http.get('/api/v1/me', ({ request }) =>
    request.headers.get('Authorization') === 'Bearer fresh'
      ? HttpResponse.json({ id: 'u1', fullName: 'Hannah Okafor' })
      : problem(401, 'UNAUTHENTICATED'),
  );

describe('api', () => {
  it('refreshes once and retries when the access token has expired', async () => {
    server.use(protectedMe());
    await expect(api('/me', { schema: meSchema })).resolves.toEqual({
      id: 'u1',
      fullName: 'Hannah Okafor',
    });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('ends the session and rethrows when the refresh is refused', async () => {
    refresh.mockResolvedValue(null);
    server.use(protectedMe());
    await expect(api('/me')).rejects.toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });
    expect(onSessionExpired).toHaveBeenCalledOnce();
  });

  it('does not refresh for public calls or other 401 codes', async () => {
    server.use(http.post('/api/v1/auth/login', () => problem(401, 'INVALID_CREDENTIALS')));
    await expect(
      api('/auth/login', { method: 'POST', body: {}, auth: false }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('turns problem+json into an ApiError with extras, field errors, Retry-After and a reference', async () => {
    token = 'fresh';
    server.use(
      http.post('/api/v1/bookings', () =>
        problem(
          409,
          'NO_MENTOR_AVAILABLE',
          {
            alternatives: [{ start: '2026-10-24T17:00:00Z', end: '2026-10-24T18:00:00Z' }],
            errors: [{ path: 'slotStart', message: 'Taken' }],
          },
          { 'Retry-After': '30' },
        ),
      ),
    );
    const error = await api('/bookings', { method: 'POST', body: {} }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: 'NO_MENTOR_AVAILABLE',
      retryAfter: 30,
      errors: [{ path: 'slotStart', message: 'Taken' }],
      reference: '7F3A-91C2',
    });
    expect((error as ApiError).extras.alternatives).toHaveLength(1);
  });

  it('sends JSON, the bearer token and the idempotency key', async () => {
    token = 'fresh';
    let seen:
      { auth: string | null; key: string | null; type: string | null; body: unknown } | undefined;
    server.use(
      http.post('/api/v1/bookings', async ({ request }) => {
        seen = {
          auth: request.headers.get('Authorization'),
          key: request.headers.get('Idempotency-Key'),
          type: request.headers.get('Content-Type'),
          body: await request.json(),
        };
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    await api('/bookings', { method: 'POST', body: { slotStart: 'x' }, idempotencyKey: 'k-1' });
    expect(seen).toEqual({
      auth: 'Bearer fresh',
      key: 'k-1',
      type: 'application/json',
      body: { slotStart: 'x' },
    });
  });

  it('resolves empty 202 and 204 bodies to undefined', async () => {
    server.use(
      http.post('/api/v1/auth/password/forgot', () => new HttpResponse(null, { status: 202 })),
    );
    await expect(
      api('/auth/password/forgot', { method: 'POST', body: {}, auth: false }),
    ).resolves.toBeUndefined();
  });

  it('passes JSON through untouched when no schema is given (production)', async () => {
    token = 'fresh';
    server.use(http.get('/api/v1/me', () => HttpResponse.json({ id: 42 })));
    await expect(api('/me')).resolves.toEqual({ id: 42 });
  });

  it('reports transport failures as NETWORK_ERROR', async () => {
    token = 'fresh';
    server.use(http.get('/api/v1/me', () => HttpResponse.error()));
    await expect(api('/me')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it.each([
    [502, 'INTERNAL_ERROR'],
    [503, 'TEMPORARILY_UNAVAILABLE'],
    [404, 'NOT_FOUND'],
    [418, 'UNKNOWN_ERROR'],
  ])('maps a non-JSON %i from a proxy to %s', async (status, code) => {
    token = 'fresh';
    server.use(http.get('/api/v1/me', () => new HttpResponse('<html>gateway</html>', { status })));
    await expect(api('/me')).rejects.toMatchObject({ status, code });
  });

  it('rejects a response that breaks its contract in development', async () => {
    token = 'fresh';
    server.use(http.get('/api/v1/me', () => HttpResponse.json({ id: 42 })));
    await expect(api('/me', { schema: meSchema })).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });
});

describe('parseRetryAfter', () => {
  it.each([
    ['30', 30],
    ['0', 0],
    ['1.2', 2],
    [' ', undefined],
    [null, undefined],
    ['Wed, 21 Oct 2026 07:28:00 GMT', undefined],
  ])('%j -> %j', (header, expected) => {
    expect(parseRetryAfter(header)).toBe(expected);
  });
});
