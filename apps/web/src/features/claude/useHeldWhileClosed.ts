import { useState } from 'react';

// A closed sheet stays mounted for its exit animation, so it keeps showing what it showed while
// open instead of late updates such as a refetch.
export function useHeldWhileClosed<T>(open: boolean, value: T): T {
  const [held, setHeld] = useState(() => value);
  if (open && !Object.is(held, value)) setHeld(() => value);
  return open ? value : held;
}
