import { useCallback } from 'react';

/**
 * Ref for a once-only landing reveal (doc 07 row 20, `reveal` utility): sets `data-revealed` the
 * first time the element comes within 80px of the viewport, then stops observing.
 */
export function useReveal() {
  return useCallback((node: HTMLElement | null) => {
    if (!node) return;
    if (!('IntersectionObserver' in window)) {
      node.setAttribute('data-revealed', '');
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          node.setAttribute('data-revealed', '');
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -80px 0px' },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, []);
}
