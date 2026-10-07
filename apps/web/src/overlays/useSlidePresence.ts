import { useMotionValue, useTransform, type MotionValue } from 'motion/react';
import { useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import { scrimOpacity } from './sheetMath';
import { slideIn, slideOut, type SlideValues } from './slide';

export interface BottomPanelValues extends SlideValues {
  scrim: MotionValue<number>;
}

export function useBottomPanelValues(): BottomPanelValues {
  const y = useMotionValue(0);
  const travel = useMotionValue(0);
  const opacity = useMotionValue(0);
  const scrim = useTransform<number, number>([y, travel], (values) =>
    scrimOpacity(values[0] ?? 0, values[1] ?? 0),
  );
  return useMemo(() => ({ y, travel, opacity, scrim }), [y, travel, opacity, scrim]);
}

export interface SlidePresenceInput {
  enabled: boolean;
  open: boolean;
  reducedMotion: boolean;
  values: SlideValues;
  measureTravel: () => number | null;
  releaseVelocityRef: RefObject<number>;
  onExited: () => void;
}

export function useSlidePresence(input: SlidePresenceInput): void {
  const { enabled, open, reducedMotion, values, measureTravel, releaseVelocityRef, onExited } =
    input;
  const enteredRef = useRef(false);
  useLayoutEffect(() => {
    const travel = enabled ? measureTravel() : null;
    if (travel === null) return;
    if (open) {
      const stop = slideIn(values, travel, reducedMotion, !enteredRef.current);
      enteredRef.current = true;
      return stop;
    }
    const velocity = releaseVelocityRef.current;
    releaseVelocityRef.current = 0;
    values.travel.set(travel);
    return slideOut(values, velocity, reducedMotion, onExited);
  }, [enabled, open, reducedMotion, values, measureTravel, releaseVelocityRef, onExited]);
}
