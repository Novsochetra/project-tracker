import { useEffect, useLayoutEffect, useRef } from 'react';

/** Calls `retry` each time the device comes back online while `active`. */
export function useRetryWhenOnline(active: boolean, retry: () => void): void {
  const retryRef = useRef(retry);
  useLayoutEffect(() => {
    retryRef.current = retry;
  });
  useEffect(() => {
    if (!active) return;
    const onOnline = () => retryRef.current();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [active]);
}
