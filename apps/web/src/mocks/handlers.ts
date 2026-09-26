import { http, HttpResponse, type HttpHandler } from 'msw';

import {
  buildAuthResponse,
  buildBookingConfig,
  buildMe,
  buildProblem,
  buildRefreshResponse,
  buildSlotsResponse,
  buildTimezones,
} from '@app/contracts/testing';

const API = '/api/v1';

function problem(code: Parameters<typeof buildProblem>[0], extras?: Record<string, unknown>) {
  const body = buildProblem(code, extras);
  return HttpResponse.json(body, { status: body.status });
}

/**
 * Default API handlers built from @app/contracts fixtures. Component tests start anonymous and
 * add scenario handlers with server.use(); `VITE_API_MOCKS=1` serves the same set in the browser.
 */
export const handlers: HttpHandler[] = [
  http.post(`${API}/auth/refresh`, () => problem('REFRESH_TOKEN_INVALID')),
  http.post(`${API}/auth/logout`, () => new HttpResponse(null, { status: 204 })),
  http.get(`${API}/meta/timezones`, () => HttpResponse.json(buildTimezones())),
  http.get(`${API}/meta/booking-config`, () => HttpResponse.json(buildBookingConfig())),
  http.get(`${API}/availability/slots`, ({ request }) => {
    const url = new URL(request.url);
    const timezone = url.searchParams.get('tz') ?? 'Europe/London';
    const from = url.searchParams.get('from') ?? undefined;
    const days = Number(url.searchParams.get('days') ?? 14);
    return HttpResponse.json(buildSlotsResponse({ timezone, ...(from && { from }), days }));
  }),
];

/** Handlers for a signed-in parent (Hannah Okafor, London). */
export const signedInHandlers: HttpHandler[] = [
  http.post(`${API}/auth/refresh`, () => HttpResponse.json(buildRefreshResponse())),
  http.get(`${API}/me`, () => HttpResponse.json(buildMe())),
  http.post(`${API}/auth/login`, () => HttpResponse.json(buildAuthResponse())),
];
