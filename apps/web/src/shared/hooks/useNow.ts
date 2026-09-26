import { useEffect, useState } from 'react';

import { epochMs, nowInstant } from '@app/time';

/** The current time in epoch milliseconds, refreshed every `intervalMs` (for time-based UI states). */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => epochMs(nowInstant()));
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(epochMs(nowInstant()));
    }, intervalMs);
    return () => {
      clearInterval(timer);
    };
  }, [intervalMs]);
  return now;
}
