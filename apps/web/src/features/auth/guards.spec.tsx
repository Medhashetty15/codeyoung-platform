import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { GuestOnly, RequireAuth } from './guards';
import { useSessionStore, type SessionStatus } from './session-store';

function Where() {
  const location = useLocation();
  const notice = (location.state as { notice?: string } | null)?.notice;
  return (
    <p>
      at {`${location.pathname}${location.search}`}
      {notice ? ` with ${notice}` : ''}
    </p>
  );
}

function renderAt(
  path: string,
  status: SessionStatus,
  endedBy: 'logout' | 'expired' | null = null,
) {
  useSessionStore.setState({
    status,
    accessToken: status === 'authenticated' ? 't' : null,
    endedBy,
  });
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
    useSessionStore.setState({ status: 'unknown', accessToken: null, endedBy: null });
  });

  it('shows the fallback while the session is still being checked', () => {
    renderAt('/bookings?scope=past', 'unknown');
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });

  it('sends anonymous visitors to log in with the page to return to', () => {
    renderAt('/bookings?scope=past', 'anonymous');
    expect(screen.getByText('at /login?returnTo=%2Fbookings%3Fscope%3Dpast')).toBeInTheDocument();
  });

  it('adds the "you were logged out" notice when the session expired', () => {
    renderAt('/bookings', 'anonymous', 'expired');
    expect(
      screen.getByText('at /login?returnTo=%2Fbookings with session-expired'),
    ).toBeInTheDocument();
  });

  it('stays out of the way while a logout takes the parent home', () => {
    renderAt('/bookings', 'anonymous', 'logout');
    expect(screen.queryByText(/^at /)).toBeNull();
    expect(screen.queryByText('Bookings')).toBeNull();
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
