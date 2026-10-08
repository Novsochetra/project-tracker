import { useEffect, useState } from 'react';

/** True from the render where `value` changes until `ms` later; false on the first render. */
export function useJustChanged(value: unknown, ms: number): boolean {
  const [seen, setSeen] = useState(value);
  const [changed, setChanged] = useState(false);
  // Set during render, so the very first render with the new value already reports the change.
  if (!Object.is(seen, value)) {
    setSeen(value);
    setChanged(true);
  }
  useEffect(() => {
    if (!changed) return;
    const timer = setTimeout(() => setChanged(false), ms);
    return () => clearTimeout(timer);
  }, [changed, seen, ms]);
  return changed;
}
