import { createBrowserRouter, type RouteObject } from 'react-router';

import { GuestOnly, RequireAuth } from '../features/auth';

import { AppShell } from './AppShell';
import { NotFound } from './NotFound';
import { PageSkeleton } from './PageSkeleton';
import { RouteError } from './RouteError';

/** Every route module is its own chunk and exports `Component` (doc 05 §12.4). */
export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      {
        // Errors inside a page keep the header and footer around them.
        errorElement: <RouteError />,
        children: [
          { index: true, lazy: () => import('../routes/Landing') },
          { path: 'book', lazy: () => import('../routes/Book') },
          { path: 'book/confirm', lazy: () => import('../routes/BookConfirm') },
          { path: 'class/:joinToken', lazy: () => import('../routes/Classroom') },
          { path: 'privacy', lazy: () => import('../routes/Privacy') },
          { path: 'terms', lazy: () => import('../routes/Terms') },
          {
            element: <GuestOnly />,
            children: [
              { path: 'login', lazy: () => import('../routes/Login') },
              { path: 'register', lazy: () => import('../routes/Register') },
              { path: 'forgot-password', lazy: () => import('../routes/ForgotPassword') },
              { path: 'reset-password', lazy: () => import('../routes/ResetPassword') },
            ],
          },
          {
            element: <RequireAuth fallback={<PageSkeleton />} />,
            children: [
              { path: 'bookings', lazy: () => import('../routes/Bookings') },
              { path: 'bookings/:id', lazy: () => import('../routes/BookingDetail') },
              { path: 'bookings/:id/reschedule', lazy: () => import('../routes/Reschedule') },
              { path: 'account', lazy: () => import('../routes/Account') },
            ],
          },
          ...(import.meta.env.DEV
            ? [{ path: 'dev/gallery', lazy: () => import('../dev/Gallery') }]
            : []),
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
];

export function createRouter() {
  return createBrowserRouter(routes);
}
