import { useEffect, useRef } from 'react';
import { revealInSight } from '../../requests/revealActions';
import type { RunRequests } from '../../requests/useRequests';

// A ticket opened while Claude waits on it brings the open request into sight (PT-168), but only
// as the screen first shows the run's requests: one that comes later is announced instead, so the
// screen never moves under the person's finger.
export function useRevealWaiting({ loaded, waiting }: Pick<RunRequests, 'loaded' | 'waiting'>) {
  const cardsRef = useRef<HTMLDivElement>(null);
  const seen = useRef(false);
  useEffect(() => {
    if (seen.current || !loaded) return;
    seen.current = true;
    const card = cardsRef.current?.querySelector<HTMLElement>('[data-open]');
    if (waiting && card) revealInSight(card);
  }, [loaded, waiting]);
  return cardsRef;
}
