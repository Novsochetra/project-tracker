import { useEffect, useState } from 'react';

// By the phone's clock, as the ticket's request card says No answer by it: a helper that is gone
// sends no event when its request runs out, and only waiting rows hold a timer.
export function useStillWaiting(until: number | null): boolean {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (until === null) return;
    const timer = setTimeout(() => setNow(Date.now()), until - Date.now());
    return () => clearTimeout(timer);
  }, [until]);
  return until !== null && until > now;
}
