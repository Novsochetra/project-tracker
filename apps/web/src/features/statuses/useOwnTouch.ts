import { useEffect, useRef, type RefObject } from 'react';

// On phones the sheet body turns a downward touch drag at its top into "dismiss the sheet".
// A drag that starts on a reorder handle is a reorder, so its touches never reach the body.
export function useOwnTouch<T extends HTMLElement>(): RefObject<T | null> {
  const ref = useRef<T>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const stop = (event: TouchEvent) => event.stopPropagation();
    element.addEventListener('touchstart', stop, { passive: true });
    return () => element.removeEventListener('touchstart', stop);
  }, []);
  return ref;
}
