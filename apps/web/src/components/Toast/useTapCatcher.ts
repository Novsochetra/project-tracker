import { useCallback, type RefCallback } from 'react';

const keepTap = () => undefined;

// WebKit gives a tap's click to the nearest element around the finger that has a click listener
// of its own, and React's listener on the page's root doesn't count beside a row's. So a tap in
// the band's top ~10px, whose area reaches past the band's edge, opened the row behind it. With a
// listener of its own the band is the nearest and keeps the tap.
export function useTapCatcher(catching: boolean): RefCallback<HTMLElement> {
  return useCallback(
    (band: HTMLElement | null) => {
      if (!band || !catching) return;
      band.addEventListener('click', keepTap);
      return () => band.removeEventListener('click', keepTap);
    },
    [catching],
  );
}
