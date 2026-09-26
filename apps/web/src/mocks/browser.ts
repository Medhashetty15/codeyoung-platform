import { setupWorker } from 'msw/browser';

import { handlers, signedInHandlers } from './handlers';

/**
 * Development-only mock API (doc 06 M7): `VITE_API_MOCKS=1 npm run dev:web`. Add `?mock=signed-in`
 * to start as the fixture parent.
 */
export async function startMockApi(): Promise<void> {
  const signedIn = new URLSearchParams(window.location.search).get('mock') === 'signed-in';
  const worker = setupWorker(...(signedIn ? [...signedInHandlers, ...handlers] : handlers));
  await worker.start({ onUnhandledRequest: 'bypass', quiet: true });
}
