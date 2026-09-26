import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { GuestOnly, RequireAuth } from './guards';
import { useSessionStore, type SessionStatus } from './session-store';

function Where() {
  const location = useLocation();
  return <p>at {`${location.pathname}${location.search}`}</p>;
}

function renderAt(path: string, status: SessionStatus) {
  useSessionStore.setState({ status, accessToken: status === 'authenticated' ? 't' : null });
  const router = createMemoryRouter(
    [
      {
        element: <RequireAuth fallback={<p>Loading</p>} />,
        children: [{ path: '/bookings', element: <p>Bookings</p> }],
      },
      { element: <GuestOnly />, children: [{ path: '/login', element: <Where /> }] },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
}

describe('guards', () => {
  beforeEach(() => {
    useSessionStore.setState({ status: 'unknown', accessToken: null });
  });

  it('shows the fallback while the session is still being checked', () => {
    renderAt('/bookings?scope=past', 'unknown');
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });

  it('sends anonymous visitors to log in with the page to return to', () => {
    renderAt('/bookings?scope=past', 'anonymous');
    expect(screen.getByText('at /login?returnTo=%2Fbookings%3Fscope%3Dpast')).toBeInTheDocument();
  });

  it('lets signed-in parents through', () => {
    renderAt('/bookings', 'authenticated');
    expect(screen.getByText('Bookings')).toBeInTheDocument();
  });

  it('sends signed-in parents away from guest-only pages', () => {
    renderAt('/login', 'authenticated');
    expect(screen.getByText('Bookings')).toBeInTheDocument();
  });
});
