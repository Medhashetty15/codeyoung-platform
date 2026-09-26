import { prefetchZonePicker } from '../features/timezone';

export const loadMobileNavSheet = () => import('./MobileNavSheet');
export const loadAccountMenu = () => import('./AccountMenu');

/**
 * Overlays load on demand to keep the first page small, but a tap must still feel instant
 * (apple-design §1). Once the page is idle, fetch their chunks in the background; triggers also
 * prefetch on hover, focus and pointer-down. Skipped when the visitor asked to save data.
 */
export function prefetchOverlaysWhenIdle(): () => void {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return () => {};
  const run = () => {
    void loadMobileNavSheet();
    void loadAccountMenu();
    prefetchZonePicker();
  };
  if ('requestIdleCallback' in window) {
    const handle = window.requestIdleCallback(run, { timeout: 3000 });
    return () => {
      window.cancelIdleCallback(handle);
    };
  }
  const timer = setTimeout(run, 1500);
  return () => {
    clearTimeout(timer);
  };
}
