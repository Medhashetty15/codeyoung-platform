import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './styles/index.css';
import { App } from './app/App';
import { config } from './shared/config';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

// The mock API must be listening before the app's first request (the boot refresh).
if (config.apiMocks) {
  const { startMockApi } = await import('./mocks/browser');
  await startMockApi();
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
