import { useEffect, useState } from 'react';

// By the phone's clock, as the ticket's request card says No answer by it: a helper that is gone
// sends no event when its request runs out, and only waiting rows hold a timer.
export function useStillWaiting(until: number | null): boolean {
  const [mountedAt] = useState(Date.now);
  // The fired timer ends the wait itself, since a clock set back would still read before `until`.
  const [ended, setEnded] = useState<number | null>(null);
  useEffect(() => {
    if (until === null) return;
    const timer = setTimeout(() => setEnded(until), until - Date.now());
    return () => clearTimeout(timer);
  }, [until]);
  return until !== null && until !== ended && until > mountedAt;
}
