import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildAuthResponse,
  buildBooking,
  buildMe,
  buildProblem,
  buildRefreshResponse,
  buildStudents,
  slotsScenarios,
} from '@app/contracts/testing';
import { deviceZone } from '@app/time';

import { useSessionStore } from '../features/auth';
import { useZoneStore } from '../features/timezone/zone-store';
import { server } from '../test/msw';
import { renderApp } from '../test/render-app';

const SLOT = '2026-10-24T16:00:00Z';
const CONFIRM = `/book/confirm?slot=${encodeURIComponent(SLOT)}&tz=Europe%2FLondon`;

const problem = (code: Parameters<typeof buildProblem>[0], extras?: Record<string, unknown>) => {
  const body = buildProblem(code, extras);
  return HttpResponse.json(body, { status: body.status });
};

function signedIn() {
  server.use(
    http.post('/api/v1/auth/refresh', () => HttpResponse.json(buildRefreshResponse())),
    http.get('/api/v1/me', () => HttpResponse.json(buildMe())),
    http.get('/api/v1/me/students', () => HttpResponse.json(buildStudents())),
  );
}

let stop: () => void = () => {};
beforeEach(() => {
  useSessionStore.setState({ status: 'unknown', accessToken: null, endedBy: null });
  useZoneStore.setState({ chosen: null, saved: null });
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-GB']);
  server.use(
    http.get('/api/v1/availability/slots', () => HttpResponse.json(slotsScenarios.available())),
  );
});
afterEach(() => {
  stop();
  sessionStorage.clear();
});

function open(path = CONFIRM) {
  const app = renderApp(path, { session: true });
  stop = app.stop;
  return app;
}

describe('confirm, signed out', () => {
  it('creates an account inline and swaps to the confirm step without losing the time', async () => {
    server.use(
      http.post('/api/v1/auth/register', () =>
        HttpResponse.json(buildAuthResponse(), { status: 201 }),
      ),
      http.get('/api/v1/me/students', () => HttpResponse.json([])),
    );
    open();
    expect(await screen.findByRole('tab', { name: 'Create account' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await userEvent.type(screen.getByLabelText('Full name'), 'Hannah Okafor');
    await userEvent.type(screen.getByLabelText('Email'), 'hannah@okafor.co.uk');
    await userEvent.type(screen.getByLabelText('Password'), 'sunflowers in october');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(
      await screen.findByRole('heading', { name: 'Who is the class for?' }),
    ).toBeInTheDocument();
    // No children yet: "Add a child" is preselected.
    expect(screen.getByRole('radio', { name: 'Add a child' })).toBeChecked();
    expect(screen.getByRole('complementary', { name: 'Your trial' })).toHaveTextContent(
      'Saturday 24 October',
    );
  });
});

describe('confirm, signed in', () => {
  it('lists the children, keeping a child with a trial visible but unavailable', async () => {
    signedIn();
    open();
    const leo = await screen.findByRole('radio', { name: 'Leo, 9' });
    expect(leo).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Maya, 12' })).toBeDisabled();
    expect(screen.getByText(/Maya already has a trial on Tue 27 Oct\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View booking' })).toHaveAttribute(
      'href',
      '/bookings/0b6c3d5e-8f4a-4c1b-9d2e-7a6b5c4d3e2f',
    );
  });

  it('books with an idempotency key, reuses it on retry and opens the confirmation', async () => {
    signedIn();
    const keys: (string | null)[] = [];
    let body: unknown;
    let calls = 0;
    server.use(
      http.post('/api/v1/bookings', async ({ request }) => {
        calls += 1;
        keys.push(request.headers.get('Idempotency-Key'));
        body = await request.json();
        return calls === 1
          ? problem('TEMPORARILY_UNAVAILABLE', { retryAfterSeconds: 2 })
          : HttpResponse.json(buildBooking(), { status: 201 });
      }),
      http.get('/api/v1/bookings/:id', () => HttpResponse.json(buildBooking())),
    );
    const { router } = open();
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm trial' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't reach our servers.");
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/bookings/0b6c3d5e-8f4a-4c1b-9d2e-7a6b5c4d3e2f');
    });
    expect(router.state.location.search).toBe('?new=1');
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(keys[1]).toBe(keys[0]);
    expect(body).toEqual({
      slotStart: SLOT,
      timezone: 'Europe/London',
      student: { id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d' },
    });
    expect(
      await screen.findByRole('heading', { level: 1, name: "Leo's trial is booked" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/We have emailed the details to hannah@okafor\.co\.uk\./),
    ).toBeInTheDocument();
  });

  it('offers nearby times in a dialog when another family took the slot', async () => {
    signedIn();
    const alternatives = [
      { start: '2026-10-24T17:00:00Z', end: '2026-10-24T18:00:00Z' },
      { start: '2026-10-27T17:00:00Z', end: '2026-10-27T18:00:00Z' },
    ];
    server.use(
      http.post('/api/v1/bookings', () => problem('NO_MENTOR_AVAILABLE', { alternatives })),
    );
    const { router } = open();
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm trial' }));
    const dialog = await screen.findByRole('dialog', { name: 'That time was just booked' });
    expect(dialog).toHaveTextContent('These times are still free:');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Sat 24 Oct, 18:00' }));
    await waitFor(() => {
      expect(new URLSearchParams(router.state.location.search).get('slot')).toBe(
        '2026-10-24T17:00:00Z',
      );
    });
  });

  it('shows alternatives before confirming when the time is already gone', async () => {
    signedIn();
    const response = slotsScenarios.available();
    server.use(
      http.get('/api/v1/availability/slots', () =>
        HttpResponse.json({
          ...response,
          days: response.days.map((day) => ({
            ...day,
            slots: day.slots.filter((slot) => slot.start !== SLOT),
          })),
        }),
      ),
    );
    open();
    expect(
      await screen.findByText(
        'That time was just booked by another family. These times are still free:',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm trial' })).toBeNull();
  });

  it('goes back to the same day when the time can no longer be booked', async () => {
    signedIn();
    server.use(http.post('/api/v1/bookings', () => problem('SLOT_IN_PAST')));
    const { router } = open();
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm trial' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/book');
    });
    expect(router.state.location.search).toBe('?tz=Europe%2FLondon&date=2026-10-24');
  });

  it('checks a new child inline and explains a name clash', async () => {
    signedIn();
    server.use(http.post('/api/v1/bookings', () => problem('STUDENT_NAME_TAKEN')));
    open();
    await userEvent.click(await screen.findByRole('radio', { name: 'Add a child' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm trial' }));
    expect(screen.getByText("Enter your child's first name.")).toBeInTheDocument();
    expect(screen.getByText('Choose an age.')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('First name'), 'Leo');
    await userEvent.selectOptions(screen.getByLabelText('Age'), '9');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm trial' }));
    expect(
      await screen.findByText('You already have a child called Leo. Choose them above.'),
    ).toBeInTheDocument();
  });

  it('counts down after too many attempts', async () => {
    signedIn();
    server.use(
      http.post('/api/v1/bookings', () => problem('RATE_LIMITED', { retryAfterSeconds: 30 })),
    );
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm trial' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many attempts. Try again in 30 seconds.',
    );
    expect(screen.getByRole('button', { name: 'Confirm trial' })).toBeDisabled();
  });

  it('flags a device zone that differs from the booking zone, with a one-tap switch', async () => {
    signedIn();
    const other = deviceZone() === 'Asia/Tokyo' ? 'Europe/London' : 'Asia/Tokyo';
    open(`/book/confirm?slot=${encodeURIComponent(SLOT)}&tz=${encodeURIComponent(other)}`);
    expect(
      await screen.findByText(/^Your device is set to .*\. Are you booking in .*\?$/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /^Your profile uses London time\. We will switch it to .* so your emails match\.$/,
      ),
    ).toBeInTheDocument();
  });
});

describe('confirmation page', () => {
  it('offers the calendar file through an authenticated download', async () => {
    signedIn();
    server.use(
      http.get('/api/v1/bookings/:id', () => HttpResponse.json(buildBooking())),
      http.get('/api/v1/bookings/:id/calendar.ics', ({ request }) =>
        request.headers.get('Authorization')
          ? new HttpResponse('BEGIN:VCALENDAR', { headers: { 'Content-Type': 'text/calendar' } })
          : problem('UNAUTHENTICATED'),
      ),
    );
    const createObjectURL = vi.fn(() => 'blob:ics');
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    open('/bookings/0b6c3d5e-8f4a-4c1b-9d2e-7a6b5c4d3e2f?new=1');
    await userEvent.click(await screen.findByRole('button', { name: 'Add to calendar' }));
    expect(await screen.findByRole('menuitem', { name: 'Google Calendar' })).toHaveAttribute(
      'href',
      expect.stringContaining('https://calendar.google.com/calendar/render?action=TEMPLATE'),
    );
    await userEvent.click(screen.getByRole('menuitem', { name: 'Apple or Outlook (.ics)' }));
    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalledOnce();
    });
    expect(screen.getByText('CY-7K3Q9P')).toBeInTheDocument();
  });
});
