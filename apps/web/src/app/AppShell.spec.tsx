import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { useSessionStore } from '../features/auth';
import { createQueryClient } from '../shared/api/query-client';
import { server } from '../test/msw';

import { routes } from './router';

function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

function header() {
  return screen.getByRole('banner');
}

describe('app shell', () => {
  beforeEach(() => {
    useSessionStore.setState({ status: 'anonymous', accessToken: null });
  });

  it('offers log in and the booking CTA to visitors', async () => {
    renderApp('/');
    await screen.findByRole('heading', {
      level: 1,
      name: 'Book a free coding class for your child',
    });
    expect(within(header()).getByRole('link', { name: 'Log in' })).toHaveAttribute(
      'href',
      '/login',
    );
    expect(within(header()).getByRole('link', { name: 'Book a free trial' })).toHaveAttribute(
      'href',
      '/book',
    );
  });

  it('does not repeat the booking CTA inside the booking flow', async () => {
    renderApp('/book');
    await screen.findByRole('heading', { level: 1, name: 'Pick a time' });
    expect(
      within(header()).queryByRole('link', { name: 'Book a free trial' }),
    ).not.toBeInTheDocument();
  });

  it('shows My bookings and the account menu to signed-in parents', async () => {
    useSessionStore.setState({ status: 'authenticated', accessToken: 't' });
    server.use(
      http.get('/api/v1/me', () =>
        HttpResponse.json({
          id: 'u1',
          email: 'hannah@okafor.co.uk',
          fullName: 'Hannah Okafor',
          phone: null,
          timezone: 'Europe/London',
        }),
      ),
    );
    renderApp('/');
    await screen.findByRole('heading', { level: 1 });
    expect(within(header()).getByRole('link', { name: 'My bookings' })).toBeInTheDocument();
    await userEvent.click(await within(header()).findByRole('button', { name: 'Account menu' }));
    expect(await screen.findByText('hannah@okafor.co.uk')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Log out' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'System' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('renders a helpful not-found page for unknown paths', async () => {
    renderApp('/no-such-page');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the home page' })).toHaveAttribute('href', '/');
  });

  it('moves focus to the new page heading after navigation', async () => {
    const router = renderApp('/');
    await screen.findByRole('heading', { level: 1 });
    await router.navigate('/terms');
    const heading = await screen.findByRole('heading', { level: 1, name: 'Trial class terms' });
    await expect.poll(() => document.activeElement).toBe(heading);
  });

  it('links the policy pages from the footer', async () => {
    renderApp('/');
    const footer = await screen.findByRole('contentinfo');
    expect(within(footer).getByRole('link', { name: 'How we handle your data' })).toHaveAttribute(
      'href',
      '/privacy',
    );
    expect(within(footer).getByRole('link', { name: 'support@codeyoung.dev' })).toHaveAttribute(
      'href',
      'mailto:support@codeyoung.dev',
    );
    expect(within(footer).getByRole('group', { name: 'Theme' })).toBeInTheDocument();
    expect(within(footer).getByRole('radio', { name: 'System' })).toBeChecked();
  });
});
