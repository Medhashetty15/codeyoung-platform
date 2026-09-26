import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router';

import { loginPathFor, sanitizeReturnTo } from './return-to';
import { useSessionStatus, useSessionStore } from './session-store';

/** Protected routes: skeleton while the boot refresh settles, login with returnTo when anonymous. */
export function RequireAuth({ fallback }: { fallback: ReactNode }) {
  const status = useSessionStatus();
  const endedBy = useSessionStore((state) => state.endedBy);
  const location = useLocation();
  if (status === 'unknown') return fallback;
  if (status === 'anonymous') {
    // Logging out navigates home by itself; redirecting to login here would race it.
    if (endedBy === 'logout') return null;
    return (
      <Navigate
        to={loginPathFor(`${location.pathname}${location.search}`)}
        replace
        state={endedBy === 'expired' ? { notice: 'session-expired' } : undefined}
      />
    );
  }
  return <Outlet />;
}

/**
 * Login, register and password pages: signed-in parents go where they were heading (`returnTo`),
 * else to My bookings (doc 05 §10). This is also how a successful login leaves the page.
 */
export function GuestOnly() {
  const status = useSessionStatus();
  const [searchParams] = useSearchParams();
  if (status === 'authenticated') {
    return <Navigate to={sanitizeReturnTo(searchParams.get('returnTo')) ?? '/bookings'} replace />;
  }
  return <Outlet />;
}
