import { QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense, useEffect, useState } from 'react';
import { RouterProvider } from 'react-router';

import { initSession } from '../features/auth';
import { createQueryClient } from '../shared/api/query-client';
import { watchSystemTheme } from '../shared/theme/theme';

import { createRouter } from './router';

// Toasts are never needed for the first paint; Sonner loads in its own chunk.
const Toaster = lazy(() =>
  import('../shared/ui/Toaster').then((module) => ({ default: module.Toaster })),
);

/** Providers, router and session boot. One QueryClient and one router per page load. */
export function App() {
  const [queryClient] = useState(createQueryClient);
  const [router] = useState(createRouter);

  useEffect(() => {
    const stopTheme = watchSystemTheme();
    const stopSession = initSession({
      queryClient,
      navigate: (to, options) => void router.navigate(to, options),
      currentPath: () => `${router.state.location.pathname}${router.state.location.search}`,
    });
    return () => {
      stopTheme();
      stopSession();
    };
  }, [queryClient, router]);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Suspense fallback={null}>
        <Toaster />
      </Suspense>
    </QueryClientProvider>
  );
}
