import { useEffect, useState } from 'react';
import { settleViewers, viewersLoaded } from './viewerParts';

// Whether the viewers' code is in, or failed to load, so rendering one won't wait. Through a
// Suspense fallback instead, React holds the content back for 300 ms after the fallback showed: a
// delay on every fast load that just missed the press.
export function useViewersSettled(wanted: boolean): boolean {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!wanted) return;
    let live = true;
    void settleViewers().then(() => {
      if (live) setSettled(true);
    });
    return () => {
      live = false;
    };
  }, [wanted]);
  return settled || viewersLoaded();
}
