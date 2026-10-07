import { useMemo, useSyncExternalStore } from 'react';
import type { Size } from './zoomMath';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
}

const readWidth = (): number => window.innerWidth;
const readHeight = (): number => window.innerHeight;

export function useViewportSize(): Size {
  const width = useSyncExternalStore(subscribe, readWidth, () => 0);
  const height = useSyncExternalStore(subscribe, readHeight, () => 0);
  return useMemo(() => ({ width, height }), [width, height]);
}
