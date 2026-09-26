import { useEffect, useState } from 'react';

/** Whole seconds left, ticking down once a second from `seconds` (restarts when `seconds` changes). */
export function useCountdown(seconds: number | undefined): number {
  const [left, setLeft] = useState(seconds ?? 0);
  const [from, setFrom] = useState(seconds);
  if (from !== seconds) {
    setFrom(seconds);
    setLeft(seconds ?? 0);
  }
  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(() => {
      setLeft((current) => current - 1);
    }, 1000);
    return () => {
      clearTimeout(timer);
    };
  }, [left]);
  return left;
}
