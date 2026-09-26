import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildBooking,
  buildBookingList,
  buildBookingSummary,
  buildMe,
  buildProblem,
  buildRefreshResponse,
  FIXTURE_IDS,
  slotsScenarios,
} from '@app/contracts/testing';

import { useSessionStore } from '../features/auth';
import { useZoneStore } from '../features/timezone/zone-store';
import { server } from '../test/msw';
import { renderApp } from '../test/render-app';

const BOOKING = FIXTURE_IDS.booking;
const MOVED = FIXTURE_IDS.rescheduledBooking;

const problem = (code: Parameters<typeof buildProblem>[0], extras?: Record<string, unknown>) => {
  const body = buildProblem(code, extras);
  return HttpResponse.json(body, { status: body.status });
};

let stop: () => void = () => {};
beforeEach(() => {
  useSessionStore.setState({ status: 'unknown', accessToken: null, endedBy: null });
  useZoneStore.setState({ chosen: null, saved: null });
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-GB']);
  server.use(
    http.post('/api/v1/auth/refresh', () => HttpResponse.json(buildRefreshResponse())),
    http.get('/api/v1/me', () => HttpResponse.json(buildMe())),
    http.get('/api/v1/availability/slots', () => HttpResponse.json(slotsScenarios.available())),
  );
});
afterEach(() => {
  stop();
  sessionStorage.clear();
});

/** The row menus load after the page; wait for the real trigger before pressing it. */
async function menuTrigger(name: string) {
  await screen.findByRole('button', { name });
  await waitFor(() => {
    expect(screen.getByRole('button', { name })).toHaveAttribute('aria-expanded');
  });
  return screen.getByRole('button', { name });
}

function open(path: string) {
  const app = renderApp(path, { session: true });
  stop = app.stop;
  return app;
}

describe('my bookings', () => {
  it('lists upcoming trials in the parent zone and pages with the cursor', async () => {
    const cursors: (string | null)[] = [];
    server.use(
      http.get('/api/v1/bookings', ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        cursors.push(cursor);
        return HttpResponse.json(
          cursor
            ? buildBookingList([
                buildBookingSummary({
                  id: MOVED,
                  reference: 'CY-M2X8RT',
                  start: '2026-10-27T17:00:00Z',
                  end: '2026-10-27T18:00:00Z',
                  student: { firstName: 'Maya' },
                }),
              ])
            : buildBookingList([buildBookingSummary()], 'page-2'),
        );
      }),
    );
    open('/bookings');
    const leo = await screen.findByRole('link', {
      name: "Leo's trial, Saturday 24 October, 17:00 London time",
    });
    const row = leo.closest('li')!;
    expect(row).toHaveTextContent('Sat, 17:00 London time');
    expect(row).toHaveTextContent('Leo with Priya');
    expect(row).toHaveTextContent('CY-7K3Q9P');
    expect(within(row).getByText('Confirmed')).toBeInTheDocument();
    // Outside the class window "Join class" is secondary, and it links to the class page.
    expect(within(row).getByRole('link', { name: 'Join class' })).toHaveAttribute(
      'href',
      expect.stringContaining('/class/'),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Show more' }));
    expect(
      await screen.findByRole('link', { name: /^Maya's trial, Tuesday 27 October/ }),
    ).toBeInTheDocument();
    expect(cursors).toEqual([null, 'page-2']);
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });

  it('shows a composed empty state and keeps the Past tab in the URL', async () => {
    server.use(
      http.get('/api/v1/bookings', ({ request }) =>
        HttpResponse.json(
          new URL(request.url).searchParams.get('scope') === 'past'
            ? buildBookingList([
                buildBookingSummary({
                  status: 'RESCHEDULED',
                  canCancel: false,
                  canReschedule: false,
                  rescheduledToId: MOVED,
                }),
              ])
            : buildBookingList([]),
        ),
      ),
    );
    const { router } = open('/bookings');
    const empty = (await screen.findByText('No trial booked yet.')).parentElement!;
    expect(within(empty).getByRole('link', { name: 'Book a free trial' })).toHaveAttribute(
      'href',
      '/book',
    );

    await userEvent.click(screen.getByRole('tab', { name: 'Past' }));
    expect(await screen.findByText('Moved')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See the new time' })).toHaveAttribute(
      'href',
      `/bookings/${MOVED}`,
    );
    // A moved trial is read-only.
    expect(screen.queryByRole('link', { name: 'Join class' })).toBeNull();
    expect(router.state.location.search).toBe('?tab=past');
  });

  it('cancels from the row menu with an optional reason', async () => {
    let body: unknown;
    let cancelled = false;
    server.use(
      http.get('/api/v1/bookings', () =>
        HttpResponse.json(buildBookingList(cancelled ? [] : [buildBookingSummary()])),
      ),
      http.post('/api/v1/bookings/:id/cancel', async ({ request }) => {
        body = await request.json();
        cancelled = true;
        return HttpResponse.json(
          buildBooking({ status: 'CANCELLED', canCancel: false, canReschedule: false }),
        );
      }),
    );
    open('/bookings');
    await userEvent.click(await menuTrigger("More actions for Leo's trial"));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Cancel' }));
    const dialog = await screen.findByRole('dialog', {
      name: "Cancel Leo's trial on Sat 24 Oct?",
    });
    expect(dialog).toHaveTextContent('The time will be offered to another family.');
    await userEvent.selectOptions(
      within(dialog).getByLabelText(/Reason/),
      'My child can no longer make it',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel trial' }));

    expect(await screen.findByText('No trial booked yet.')).toBeInTheDocument();
    expect(body).toEqual({ reason: 'CHILD_UNAVAILABLE' });
  });

  it('explains why a trial that already started cannot be cancelled', async () => {
    server.use(
      http.get('/api/v1/bookings', () => HttpResponse.json(buildBookingList())),
      http.post('/api/v1/bookings/:id/cancel', () =>
        problem('BOOKING_NOT_MODIFIABLE', { reason: 'ALREADY_STARTED' }),
      ),
    );
    open('/bookings');
    await userEvent.click(await menuTrigger("More actions for Leo's trial"));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Cancel' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel trial' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'This trial has already started, so it can no longer be changed.',
    );
    expect(within(dialog).getByRole('button', { name: 'Cancel trial' })).toBeDisabled();
  });
});

describe('booking detail', () => {
  it('keeps Reschedule visible but disabled after the cutoff, with the reason', async () => {
    server.use(
      http.get('/api/v1/bookings/:id', () =>
        HttpResponse.json(buildBooking({ canReschedule: false })),
      ),
    );
    open(`/bookings/${BOOKING}`);
    const reschedule = await screen.findByRole('button', { name: 'Reschedule' });
    expect(reschedule).toBeDisabled();
    expect(reschedule).toHaveAccessibleDescription(
      'Trials can be moved up to 2 hours before they start.',
    );
    expect(screen.getByRole('button', { name: 'Cancel trial' })).toBeEnabled();
  });

  it('links a moved trial to its new time and shows the move notice there', async () => {
    server.use(
      http.get('/api/v1/bookings/:id', ({ params }) =>
        HttpResponse.json(
          params.id === BOOKING
            ? buildBooking({
                status: 'RESCHEDULED',
                canCancel: false,
                canReschedule: false,
                rescheduledToId: MOVED,
              })
            : buildBooking({
                id: MOVED,
                start: '2026-10-27T17:00:00Z',
                end: '2026-10-27T18:00:00Z',
                rescheduledFromId: BOOKING,
              }),
        ),
      ),
    );
    open(`/bookings/${BOOKING}`);
    const link = await screen.findByRole('link', { name: 'Moved to Tue 27 Oct, 17:00' });
    expect(screen.queryByRole('button', { name: 'Cancel trial' })).toBeNull();
    await userEvent.click(link);
    expect(await screen.findByText(/^Tuesday 27 October, 17:00 London time/)).toBeInTheDocument();
  });
});

describe('reschedule', () => {
  function rescheduleHandlers(response: () => Response | Promise<Response>) {
    const calls: { key: string | null; body: unknown }[] = [];
    server.use(
      http.get('/api/v1/bookings/:id', ({ params }) =>
        HttpResponse.json(
          params.id === BOOKING
            ? buildBooking()
            : buildBooking({
                id: MOVED,
                start: '2026-10-24T17:00:00Z',
                end: '2026-10-24T18:00:00Z',
              }),
        ),
      ),
      http.post('/api/v1/bookings/:id/reschedule', async ({ request }) => {
        calls.push({ key: request.headers.get('Idempotency-Key'), body: await request.json() });
        return response();
      }),
    );
    return calls;
  }

  async function pickAnotherTime() {
    const grid = await screen.findByRole('radiogroup', { name: 'Time' });
    const current = within(grid).getByRole('radio', { name: /Current/ });
    expect(current).toBeDisabled();
    const other = within(grid)
      .getAllByRole('radio')
      .find((radio) => !(radio as HTMLInputElement).disabled)!;
    await userEvent.click(other);
    return other;
  }

  it('marks the current time, confirms the move and opens the new booking', async () => {
    const calls = rescheduleHandlers(() =>
      HttpResponse.json(
        buildBooking({ id: MOVED, start: '2026-10-24T17:00:00Z', end: '2026-10-24T18:00:00Z' }),
        { status: 201 },
      ),
    );
    const { router } = open(`/bookings/${BOOKING}/reschedule`);
    expect(
      await screen.findByText("Moving Leo's trial from Sat 24 Oct, 17:00."),
    ).toBeInTheDocument();
    const other = await pickAnotherTime();

    await userEvent.click(screen.getAllByRole('button', { name: 'Move trial' })[0]!);
    const dialog = await screen.findByRole('dialog', { name: "Move Leo's trial?" });
    expect(dialog).toHaveTextContent(/^.*Sat 24 Oct, 17:00 to .*, London time\./);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Move trial' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/bookings/${MOVED}`);
    });
    expect(router.state.location.search).toBe('?moved=1');
    expect(calls[0]?.key).toMatch(/^[0-9a-f-]{36}$/);
    expect(calls[0]?.body).toEqual({
      slotStart: (other as HTMLInputElement).value,
      timezone: 'Europe/London',
    });
    expect(
      await screen.findByText('Your trial has moved to Sat 24 Oct, 18:00.'),
    ).toBeInTheDocument();
  });

  it('offers nearby times when the new time was just taken', async () => {
    rescheduleHandlers(() =>
      problem('NO_MENTOR_AVAILABLE', {
        alternatives: [{ start: '2026-10-27T17:00:00Z', end: '2026-10-27T18:00:00Z' }],
      }),
    );
    open(`/bookings/${BOOKING}/reschedule`);
    await pickAnotherTime();
    await userEvent.click(screen.getAllByRole('button', { name: 'Move trial' })[0]!);
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Move trial' }),
    );
    const taken = await screen.findByRole('dialog', { name: 'That time was just booked' });
    expect(within(taken).getByRole('button', { name: 'Tue 27 Oct, 17:00' })).toBeInTheDocument();
  });

  it('explains the cutoff instead of showing times', async () => {
    server.use(
      http.get('/api/v1/bookings/:id', () =>
        HttpResponse.json(buildBooking({ canReschedule: false })),
      ),
    );
    open(`/bookings/${BOOKING}/reschedule`);
    expect(
      await screen.findByText('Trials can be moved up to 2 hours before they start.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the trial' })).toHaveAttribute(
      'href',
      `/bookings/${BOOKING}`,
    );
  });
});
