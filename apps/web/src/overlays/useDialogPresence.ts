import { useMotionValue, type MotionValue } from 'motion/react';
import { useLayoutEffect, useMemo } from 'react';
import { DURATION } from '../design/motion';
import { EASE_IN, EASE_OUT, stopAll, tween, type Stop } from '../gestures/animation';
import { INSTANT } from './slide';

export interface DialogValues {
  y: MotionValue<number>;
  scale: MotionValue<number>;
  opacity: MotionValue<number>;
  scrim: MotionValue<number>;
}

const DIALOG_IN = { durationMs: DURATION.base, ease: EASE_OUT };
const DIALOG_OUT = { durationMs: DURATION.fast, ease: EASE_IN };

export function useDialogValues(): DialogValues {
  const y = useMotionValue(10);
  const scale = useMotionValue(0.97);
  const opacity = useMotionValue(0);
  const scrim = useMotionValue(0);
  return useMemo(() => ({ y, scale, opacity, scrim }), [y, scale, opacity, scrim]);
}

function animateDialog(
  values: DialogValues,
  open: boolean,
  reduced: boolean,
  onExited: () => void,
) {
  const timing = reduced ? INSTANT : open ? DIALOG_IN : DIALOG_OUT;
  const stops: Stop[] = [
    tween(values.opacity, open ? 1 : 0, timing, open ? undefined : onExited),
    tween(values.y, open ? 0 : 6, timing),
    tween(values.scale, open ? 1 : 0.98, timing),
    tween(values.scrim, open ? 1 : 0, timing),
  ];
  return () => stopAll(stops);
}

export interface DialogPresenceInput {
  enabled: boolean;
  open: boolean;
  reducedMotion: boolean;
  values: DialogValues;
  onExited: () => void;
}

export function useDialogPresence(input: DialogPresenceInput): void {
  const { enabled, open, reducedMotion, values, onExited } = input;
  useLayoutEffect(() => {
    if (!enabled) return;
    return animateDialog(values, open, reducedMotion, onExited);
  }, [enabled, open, reducedMotion, values, onExited]);
}
