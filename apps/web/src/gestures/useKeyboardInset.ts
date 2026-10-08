import { useSyncExternalStore } from 'react';

export interface KeyboardInset {
  inset: number;
  viewportHeight: number;
}

function subscribe(onChange: () => void): () => void {
  const viewport = window.visualViewport;
  if (!viewport) return () => undefined;
  viewport.addEventListener('resize', onChange);
  viewport.addEventListener('scroll', onChange);
  return () => {
    viewport.removeEventListener('resize', onChange);
    viewport.removeEventListener('scroll', onChange);
  };
}

function readInset(): number {
  const viewport = window.visualViewport;
  // A pinch-zoomed page also shrinks the visual viewport; that is not a keyboard.
  if (!viewport || viewport.scale > 1.01) return 0;
  return Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop));
}

const readHeight = (): number => Math.round(window.visualViewport?.height ?? window.innerHeight);

// iOS keeps the layout viewport behind the keyboard, so fixed sheets must lift themselves.
export function useKeyboardInset(): KeyboardInset {
  const inset = useSyncExternalStore(subscribe, readInset, () => 0);
  const viewportHeight = useSyncExternalStore(subscribe, readHeight, () => 0);
  return { inset, viewportHeight };
}
