import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';

import './styles/index.css';
import { App } from './app/App';
import { watchSystemTheme } from './shared/theme/theme';
import { Toaster } from './shared/ui/Toaster';

watchSystemTheme();

// Dev-only component gallery; the dynamic import is dropped from production builds.
const Gallery = import.meta.env.DEV
  ? lazy(() => import('./dev/Gallery').then((module) => ({ default: module.Gallery })))
  : null;
const showGallery = Gallery !== null && window.location.pathname.startsWith('/dev/gallery');

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    {showGallery ? (
      <Suspense>
        <Gallery />
      </Suspense>
    ) : (
      <App />
    )}
    <Toaster />
  </StrictMode>,
);
