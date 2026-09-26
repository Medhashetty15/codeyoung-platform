import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { routes } from '../app/router';
import { initSession } from '../features/auth';
import { createQueryClient } from '../shared/api/query-client';

/**
 * Renders the real route table at `path` with a fresh query client and a live session layer
 * (MSW answers the boot refresh). Returns the router for navigation assertions.
 */
export function renderApp(path: string, { session = false }: { session?: boolean } = {}) {
  const queryClient = createQueryClient();
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const stop = session
    ? initSession({
        queryClient,
        navigate: (to, options) => void router.navigate(to, options),
        currentPath: () => `${router.state.location.pathname}${router.state.location.search}`,
      })
    : () => {};
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, queryClient, stop, ...view };
}
