import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';

import { loginPathFor } from './return-to';
import { useSessionStatus } from './session-store';

/** Protected routes: skeleton while the boot refresh settles, login with returnTo when anonymous. */
export function RequireAuth({ fallback }: { fallback: ReactNode }) {
  const status = useSessionStatus();
  const location = useLocation();
  if (status === 'unknown') return fallback;
  if (status === 'anonymous') {
    return <Navigate to={loginPathFor(`${location.pathname}${location.search}`)} replace />;
  }
  return <Outlet />;
}

/** Login, register and password pages: signed-in parents go to My bookings (doc 05 §10). */
export function GuestOnly() {
  const status = useSessionStatus();
  if (status === 'authenticated') return <Navigate to="/bookings" replace />;
  return <Outlet />;
}
