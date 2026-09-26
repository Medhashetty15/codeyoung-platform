import { useEffect, useRef, useState } from 'react';

/**
 * True once a sentinel at the top of the page has scrolled under the header. An
 * IntersectionObserver instead of a scroll listener keeps scrolling off the main thread (doc 07 row 15).
 */
export function useScrolledPast<T extends Element>() {
  const sentinelRef = useRef<T>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      setScrolled(entry ? !entry.isIntersecting : false);
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, []);
  return { sentinelRef, scrolled };
}
