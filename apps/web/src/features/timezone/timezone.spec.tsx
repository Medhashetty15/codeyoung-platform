import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildMe } from '@app/contracts/testing';

import { createQueryClient } from '../../shared/api/query-client';
import { server } from '../../test/msw';
import { useSessionStore } from '../auth';

import { DstNotice } from './DstNotice';
import { LocalTime } from './LocalTime';
import { TimezoneProvider } from './TimezoneProvider';
import { useZoneStore } from './zone-store';
import { ZoneChip } from './ZoneChip';

function Where() {
  const location = useLocation();
  return <p data-testid="where">{`${location.pathname}${location.search}`}</p>;
}

function renderWithZone(ui: ReactNode, path = '/') {
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <TimezoneProvider>
            {ui}
            <Where />
          </TimezoneProvider>
        ),
      },
    ],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

function desktop(matches: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
}

const SLOT = { start: '2026-10-24T16:00:00Z', end: '2026-10-24T17:00:00Z' };

beforeEach(() => {
  useSessionStore.setState({ status: 'anonymous', accessToken: null, endedBy: null });
  useZoneStore.setState({ chosen: null, saved: null });
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-GB']);
});
afterEach(() => {
  localStorage.clear();
});

describe('LocalTime', () => {
  it('renders the instant in the display zone inside <time datetime>', () => {
    renderWithZone(
      <>
        <LocalTime variant="date" at={SLOT.start} />
        <LocalTime variant="range" at={SLOT.start} end={SLOT.end} />
      </>,
      '/?tz=Europe/London',
    );
    expect(screen.getByText('Saturday 24 October')).toHaveAttribute(
      'datetime',
      '2026-10-24T16:00:00Z',
    );
    expect(screen.getByText('17:00 to 18:00')).toBeInTheDocument();
  });

  it('follows a legacy zone id to its canonical zone', () => {
    renderWithZone(<LocalTime variant="time" at={SLOT.start} />, '/?tz=Asia/Calcutta');
    expect(screen.getByText('21:30')).toBeInTheDocument();
  });
});

describe('DstNotice', () => {
  it('explains the clock change in the display zone', () => {
    renderWithZone(
      <DstNotice
        transition={{ at: '2026-10-25T01:00:00Z', offsetBefore: '+01:00', offsetAfter: '+00:00' }}
      />,
      '/?tz=Europe/London',
    );
    expect(
      screen.getByText(
        'Clocks in London go back one hour on Sunday 25 October. Times after that are already adjusted.',
      ),
    ).toBeInTheDocument();
  });
});

describe.each([
  ['desktop popover', true],
  ['phone sheet', false],
])('ZoneChip and picker (%s)', (_, isDesktop) => {
  it('changes the display zone, remembers it and keeps ?tz in sync', async () => {
    desktop(isDesktop);
    const user = userEvent.setup();
    renderWithZone(
      <>
        <ZoneChip at={SLOT.start} />
        <LocalTime variant="time" at={SLOT.start} />
      </>,
      '/book?tz=Europe/London',
    );
    expect(screen.getByText('17:00')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'London time (GMT+1), change time zone' }));
    const search = await screen.findByRole('combobox', { name: 'Search time zones' });
    await user.type(search, 'kolkata');
    await waitFor(() => {
      expect(screen.getAllByRole('option')).toHaveLength(1);
    });
    await user.keyboard('{Enter}');

    expect(await screen.findByText('21:30')).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('/book?tz=Asia%2FKolkata');
    expect(localStorage.getItem('cy-tz')).toBe('Asia/Kolkata');
  });
});

describe('profile time zone prompt', () => {
  it('asks a signed-in parent whether to save the new zone to the profile', async () => {
    desktop(true);
    useSessionStore.setState({ status: 'authenticated', accessToken: 't', endedBy: null });
    let patched: unknown;
    server.use(
      http.get('/api/v1/me', () => HttpResponse.json(buildMe({ timezone: 'America/New_York' }))),
      http.patch('/api/v1/me', async ({ request }) => {
        patched = await request.json();
        return HttpResponse.json(buildMe({ timezone: 'Europe/London' }));
      }),
    );
    const user = userEvent.setup();
    renderWithZone(<ZoneChip at={SLOT.start} />);

    await user.click(
      await screen.findByRole('button', { name: 'Eastern Time (GMT-4), change time zone' }),
    );
    await user.type(await screen.findByRole('combobox', { name: 'Search time zones' }), 'london');
    await waitFor(() => {
      expect(screen.getAllByRole('option')).toHaveLength(1);
    });
    await user.keyboard('{Enter}');

    const dialog = await screen.findByRole('dialog', {
      name: 'Also save London as your profile time zone?',
    });
    await user.click(screen.getByRole('button', { name: 'Save to profile' }));
    await waitFor(() => {
      expect(dialog).not.toBeInTheDocument();
    });
    expect(patched).toEqual({ timezone: 'Europe/London' });
  });
});
