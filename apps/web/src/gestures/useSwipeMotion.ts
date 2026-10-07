import { useMotionValue, type MotionValue } from 'motion/react';
import { useCallback, useMemo, useRef, type RefObject } from 'react';
import { usePrefersReducedMotion } from '../lib/media';
import { spring } from './animation';

export interface SwipeMotion {
  x: MotionValue<number>;
  full: MotionValue<number>;
  fullRef: RefObject<boolean>;
  moveTo: (target: number, velocity: number, onDone?: () => void) => void;
  setFull: (value: boolean) => void;
}

const SNAP = { visualDuration: 0.32, restDelta: 0.5 };
const EXPAND = { visualDuration: 0.22, restDelta: 0.001 };

export function useSwipeMotion(): SwipeMotion {
  const x = useMotionValue(0);
  const full = useMotionValue(0);
  const fullRef = useRef(false);
  const reducedMotion = usePrefersReducedMotion();
  const moveTo = useCallback(
    (target: number, velocity: number, onDone?: () => void) => {
      if (!reducedMotion) {
        spring(x, target, { ...SNAP, velocity }, onDone);
        return;
      }
      x.set(target);
      onDone?.();
    },
    [x, reducedMotion],
  );
  const setFull = useCallback(
    (value: boolean) => {
      fullRef.current = value;
      spring(full, value ? 1 : 0, EXPAND);
    },
    [full],
  );
  return useMemo(() => ({ x, full, fullRef, moveTo, setFull }), [x, full, moveTo, setFull]);
}
