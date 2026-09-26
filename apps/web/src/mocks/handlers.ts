import { http, HttpResponse, type HttpHandler } from 'msw';

import {
  buildAuthResponse,
  buildBooking,
  buildBookingConfig,
  buildBookingList,
  buildBookingSummary,
  buildMe,
  buildProblem,
  buildRefreshResponse,
  buildSlotsResponse,
  buildStudents,
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
  http.get(`${API}/me/students`, () => HttpResponse.json(buildStudents())),
  http.get(`${API}/bookings`, ({ request }) =>
    HttpResponse.json(
      new URL(request.url).searchParams.get('scope') === 'past'
        ? buildBookingList([
            buildBookingSummary({
              id: '5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a',
              reference: 'CY-M2X8RT',
              status: 'CANCELLED',
              start: '2026-10-10T16:00:00Z',
              end: '2026-10-10T17:00:00Z',
              canCancel: false,
              canReschedule: false,
            }),
          ])
        : buildBookingList(),
    ),
  ),
  http.get(`${API}/bookings/:id`, () => HttpResponse.json(buildBooking())),
  http.post(`${API}/bookings/:id/cancel`, () =>
    HttpResponse.json(
      buildBooking({ status: 'CANCELLED', canCancel: false, canReschedule: false }),
    ),
  ),
  http.post(`${API}/bookings/:id/reschedule`, () =>
    HttpResponse.json(
      buildBooking({ start: '2026-10-27T17:00:00Z', end: '2026-10-27T18:00:00Z' }),
      {
        status: 201,
      },
    ),
  ),
  http.get(
    `${API}/bookings/:id/calendar.ics`,
    () =>
      new HttpResponse('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n', {
        headers: { 'Content-Type': 'text/calendar' },
      }),
  ),
];
