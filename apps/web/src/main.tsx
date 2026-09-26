import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './styles/index.css';
import { App } from './app/App';
import { watchSystemTheme } from './shared/theme/theme';
import { Toaster } from './shared/ui/Toaster';

watchSystemTheme();

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <App />
    <Toaster />
  </StrictMode>,
);
