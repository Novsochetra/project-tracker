import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { haptic } from '../../../gestures/haptics';
import { swallowTapClick } from '../../../gestures/pointerClaims';
import type { DragPress } from '../../project/dnd/DragSession';
import { holdToLift } from './touchHold';
import { useLiftGuards, type TouchLift } from './useLiftGuards';

export interface HoldToLiftOptions {
  list: RefObject<HTMLElement | null>;
  liftRef: RefObject<TouchLift>;
  enabled: boolean;
  drag: (press: DragPress, id: string) => void;
}

// The finger rests until the row lifts, then drags it at once, as a ticket's handle does.
export function useHoldToLift({ list, liftRef, enabled, drag }: HoldToLiftOptions) {
  const stopHold = useRef<(() => void) | null>(null);
  useLiftGuards(list, liftRef, enabled);
  useEffect(() => () => stopHold.current?.(), []);

  return useCallback(
    (press: DragPress, id: string) => {
      liftRef.current = 'holding';
      stopHold.current = holdToLift(press, {
        onLift: (point) => {
          stopHold.current = null;
          liftRef.current = 'lifted';
          haptic('selection');
          swallowTapClick(press.pointerId);
          drag({ ...press, ...point, immediate: true }, id);
        },

        onGiveUp: () => {
          stopHold.current = null;
          liftRef.current = null;
        },
      });
    },
    [drag, liftRef],
  );
}
