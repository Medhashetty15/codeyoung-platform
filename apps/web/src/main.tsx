import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './styles/index.css';
import { App } from './app/App';
import { config } from './shared/config';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

// The mock API must be listening before the app's first request (the boot refresh).
if (config.apiMocks) {
  try {
    const { startMockApi } = await import('./mocks/browser');
    await startMockApi();
  } catch (error) {
    // Some embedded browsers block service workers; keep the app usable against the real API.
    // eslint-disable-next-line no-console -- development-only diagnostics
    console.error('VITE_API_MOCKS=1 but the mock API could not start; using the real API.', error);
  }
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
