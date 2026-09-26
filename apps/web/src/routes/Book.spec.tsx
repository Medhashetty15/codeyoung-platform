import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildProblem,
  buildWaitlistResponse,
  type buildSlotsResponse,
  slotsScenarios,
} from '@app/contracts/testing';

import { useSessionStore } from '../features/auth';
import { useZoneStore } from '../features/timezone/zone-store';
import { server } from '../test/msw';
import { renderApp } from '../test/render-app';

const SLOTS = '/api/v1/availability/slots';

function serve(response: ReturnType<typeof buildSlotsResponse>) {
  server.use(http.get(SLOTS, () => HttpResponse.json(response)));
}

beforeEach(() => {
  useSessionStore.setState({ status: 'anonymous', accessToken: null, endedBy: null });
  useZoneStore.setState({ chosen: null, saved: null });
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-GB']);
});

async function openBook(path = '/book?tz=Europe/London') {
  const app = renderApp(path);
  await screen.findByRole('radiogroup', { name: 'Day' });
  return app;
}

describe('pick a time', () => {
  it('shows a skeleton, then the days and times in the parent zone', async () => {
    serve(slotsScenarios.available());
    renderApp('/book?tz=Europe/London');
    expect(await screen.findByLabelText('Loading available times')).toBeInTheDocument();
    const day = await screen.findByRole('radio', {
      name: 'Saturday 24 October, 12 times available',
    });
    expect(day).toBeChecked();
    expect(screen.getByRole('group', { name: 'Evening' })).toBeInTheDocument();
    expect(screen.getByText('Choose a time to see it here.')).toBeInTheDocument();
  });

  it('puts the choice in the URL, fills the tray and continues to confirm', async () => {
    serve(slotsScenarios.available());
    const { router } = await openBook();
    const evening = within(screen.getByRole('group', { name: 'Evening' }));
    await userEvent.click(evening.getByRole('radio', { name: '17:00' }));

    const params = new URLSearchParams(router.state.location.search);
    expect(params.get('slot')).toBe('2026-10-24T16:00:00Z');
    expect(params.get('date')).toBe('2026-10-24');
    expect(params.get('tz')).toBe('Europe/London');

    const tray = screen.getByRole('complementary', { name: 'Your trial' });
    expect(within(tray).getByText('Saturday 24 October')).toBeInTheDocument();
    expect(within(tray).getByText('17:00 to 18:00 London time')).toBeInTheDocument();
    expect(within(tray).getByText('60 min live class, free')).toBeInTheDocument();

    await userEvent.click(within(tray).getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/book/confirm');
    });
    expect(router.state.location.search).toBe('?slot=2026-10-24T16%3A00%3A00Z&tz=Europe%2FLondon');
  });

  it('restores the selection from a shared link', async () => {
    serve(slotsScenarios.available());
    await openBook('/book?tz=Europe/London&slot=2026-10-27T18:00:00Z');
    expect(screen.getByRole('radio', { name: /^Tuesday 27 October/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: '18:00' })).toBeChecked();
  });

  it('explains a fully booked day and jumps to the next free time', async () => {
    serve(slotsScenarios.fullyBookedDay());
    const { router } = await openBook('/book?tz=Europe/London&date=2026-10-26');
    expect(screen.getByRole('radio', { name: 'Monday 26 October, fully booked' })).toBeChecked();
    expect(screen.getByText('Every mentor is booked on Monday 26 October.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Next free time: Tue 27 Oct, / }));
    expect(new URLSearchParams(router.state.location.search).get('date')).toBe('2026-10-27');
    expect(await screen.findByRole('radio', { name: /^Tuesday 27 October/ })).toBeChecked();
    expect(
      within(screen.getByRole('radiogroup', { name: 'Time' })).getByRole('radio', {
        checked: true,
      }),
    ).toBeInTheDocument();
  });

  it('explains a day without classes', async () => {
    serve(slotsScenarios.noAvailabilityDay());
    await openBook('/book?tz=Europe/London&date=2026-10-27');
    expect(
      screen.getByText('There are no trial classes on Tuesday 27 October.'),
    ).toBeInTheDocument();
  });

  it('offers the waitlist when the whole horizon is full', async () => {
    serve(slotsScenarios.windowEmpty());
    let body: unknown;
    server.use(
      http.post('/api/v1/waitlist', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(
          {
            id: '4d5e6f7a-8b9c-4d0e-9f1a-3b4c5d6e7f80',
            status: 'OPEN',
            createdAt: '2026-10-20T09:12:03Z',
          },
          { status: 201 },
        );
      }),
    );
    renderApp('/book?tz=Europe/London');
    expect(
      await screen.findByText('All trial classes for the next two weeks are taken'),
    ).toBeInTheDocument();
    await userEvent.type(await screen.findByLabelText('Full name'), 'Hannah Okafor');
    await userEvent.type(screen.getByLabelText('Email'), 'hannah@okafor.co.uk');
    await userEvent.click(screen.getByRole('button', { name: 'Join the waitlist' }));
    expect(
      await screen.findByText('We will email hannah@okafor.co.uk as soon as a time opens up.'),
    ).toBeInTheDocument();
    expect(body).toEqual({
      fullName: 'Hannah Okafor',
      email: 'hannah@okafor.co.uk',
      timezone: 'Europe/London',
    });
  });

  it('shows server field errors, and treats an email already waiting as joined', async () => {
    serve(slotsScenarios.windowEmpty());
    let calls = 0;
    server.use(
      http.post('/api/v1/waitlist', () => {
        calls += 1;
        if (calls === 1) {
          const body = buildProblem('VALIDATION_FAILED', {
            errors: [{ path: 'email', message: 'Use a real email address.' }],
          });
          return HttpResponse.json(body, { status: body.status });
        }
        // 200, not 201: this email was already on the list (same entry back).
        return HttpResponse.json(buildWaitlistResponse(), { status: 200 });
      }),
    );
    renderApp('/book?tz=Europe/London');
    await userEvent.type(await screen.findByLabelText('Full name'), 'Hannah Okafor');
    await userEvent.type(screen.getByLabelText('Email'), 'hannah@okafor.co.uk');
    await userEvent.click(screen.getByRole('button', { name: 'Join the waitlist' }));
    expect(await screen.findByText('Use a real email address.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Join the waitlist' }));
    expect(
      await screen.findByText('We will email hannah@okafor.co.uk as soon as a time opens up.'),
    ).toBeInTheDocument();
  });

  it('warns about the clock change in view', async () => {
    serve(slotsScenarios.dstWeek());
    await openBook();
    expect(
      screen.getByText(
        'Clocks in London go back one hour on Sunday 25 October. Times after that are already adjusted.',
      ),
    ).toBeInTheDocument();
  });

  it('drops a time that has just been booked', async () => {
    const response = slotsScenarios.available();
    const taken = response.days[0]!.slots.find((slot) => slot.start === '2026-10-24T16:00:00Z')!;
    const without = {
      ...response,
      days: response.days.map((day) => ({
        ...day,
        slots: day.slots.filter((slot) => slot !== taken),
      })),
    };
    serve(without);
    const { router } = await openBook(`/book?tz=Europe/London&slot=${taken.start}`);
    await waitFor(() => {
      expect(new URLSearchParams(router.state.location.search).get('slot')).toBeNull();
    });
  });

  it('shows an actionable error and retries', async () => {
    let calls = 0;
    server.use(
      http.get(SLOTS, () => {
        calls += 1;
        return calls <= 3 ? HttpResponse.error() : HttpResponse.json(slotsScenarios.available());
      }),
    );
    renderApp('/book?tz=Europe/London');
    expect(
      await screen.findByText("We couldn't load available times.", {}, { timeout: 8000 }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('radiogroup', { name: 'Day' })).toBeInTheDocument();
  }, 15_000);

  it('animates the new day for pointer changes but not for arrow keys', async () => {
    serve(slotsScenarios.available());
    await openBook();
    await userEvent.click(screen.getByRole('radio', { name: /^Sunday 25 October/ }));
    expect(screen.getByRole('radiogroup', { name: 'Time' })).toHaveClass('motion-swap-in');
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: /^Monday 26 October/ })).toBeChecked();
    expect(screen.getByRole('radiogroup', { name: 'Time' })).not.toHaveClass('motion-swap-in');
  });

  it('keeps the zone chip next to the times, not in the header', async () => {
    serve(slotsScenarios.available());
    await openBook();
    expect(
      within(screen.getByRole('banner')).queryByRole('button', { name: /change time zone/ }),
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: 'London time (GMT+1), change time zone' }),
    ).toBeInTheDocument();
  });
});
