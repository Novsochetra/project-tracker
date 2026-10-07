import type { MotionValue } from 'motion/react';
import { useLayoutEffect, useRef, type RefObject } from 'react';
import { spring } from '../gestures/animation';
import type { DragHandlers } from '../gestures/useAxisDrag';
import { sheetOffset, shouldDismissSheet } from './sheetMath';

export interface DismissDragInput {
  enabled: boolean;
  open: boolean;
  y: MotionValue<number>;
  travel: MotionValue<number>;
  measureTravel: () => number | null;
  releaseVelocityRef: RefObject<number>;
  onClose: () => void;
}

const SPRING_BACK = { visualDuration: 0.32, restDelta: 0.5 };

export function useDismissDrag(input: DismissDragInput): DragHandlers {
  const { enabled, open, y, travel, measureTravel, releaseVelocityRef, onClose } = input;
  const startRef = useRef(0);
  const openRef = useRef(open);
  useLayoutEffect(() => {
    openRef.current = open;
  });

  const springBack = (velocity: number) => spring(y, 0, { ...SPRING_BACK, velocity });

  return {
    enabled,
    onStart: () => {
      y.stop();
      startRef.current = y.get();
      const measured = measureTravel();
      if (measured !== null) travel.set(measured);
    },
    onMove: (dy) => y.set(sheetOffset(startRef.current + dy)),
    onEnd: (velocity) => {
      if (!shouldDismissSheet({ offset: y.get(), height: travel.get(), velocity })) {
        springBack(velocity);
        return;
      }
      releaseVelocityRef.current = Math.max(0, velocity);
      onClose();
      // The owner may refuse to close (unsaved changes); then the panel must come back up.
      requestAnimationFrame(() => {
        if (openRef.current) springBack(0);
      });
    },
  };
}
