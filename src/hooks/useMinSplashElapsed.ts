import { useEffect, useState } from 'react';

export const SPLASH_MIN_MS = 3000;

/** Returns true once `ms` has passed after `start` becomes true. */
export function useMinSplashElapsed(start: boolean, ms = SPLASH_MIN_MS) {
  const [elapsed, setElapsed] = useState(false);

  useEffect(() => {
    if (!start) {
      setElapsed(false);
      return;
    }
    const timer = setTimeout(() => setElapsed(true), ms);
    return () => clearTimeout(timer);
  }, [start, ms]);

  return elapsed;
}
