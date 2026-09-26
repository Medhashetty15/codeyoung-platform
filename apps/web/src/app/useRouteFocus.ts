import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';

/**
 * Moves focus to the page's h1 after client-side navigation (doc 05 §12.3), so screen readers
 * announce the new page. Skips the first render: on load the browser owns focus.
 */
export function useRouteFocus(): void {
  const { pathname } = useLocation();
  const firstRenderRef = useRef(true);
  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    // Lazy routes render their heading a frame later; wait for it.
    const frame = requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[data-page-title]')?.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [pathname]);
}
