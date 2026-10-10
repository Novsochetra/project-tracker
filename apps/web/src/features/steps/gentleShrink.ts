import { DURATION, EASE } from '../../design/motion';
import { prefersReducedMotionNow } from '../../lib/media';

// Ease-in, like a sheet going: what folds away starts slow, and at most about 20px a frame for a
// 9-line step at 60 fps; ease-out moved it 46px in its first frame.
const EASE_IN = `cubic-bezier(${EASE.in.join(', ')})`;
// Ease-in is steepest at its end, 1.67 times the mean speed.
const STEEPEST = 1 / (1 - EASE.in[0]);
const FRAME_MS = 1000 / 60;
const FRAME_PX = 24;

// Longer for a longer way, so a 40-line step folds as calmly as a short one, up to grow's length.
export function foldMotion(px: number): KeyframeAnimationOptions {
  const duration = Math.min(
    Math.max((px * STEEPEST * FRAME_MS) / FRAME_PX, DURATION.base),
    DURATION.grow,
  );
  return { duration, easing: EASE_IN };
}

// Only a shrink is eased: a new step grows the list by its own row, which fades in, and an eased
// growth would hold the newest row below the end that useFollowEnd scrolled to.
export function shrinkFrames(from: number | null, to: number): Keyframe[] | null {
  if (from === null || to >= from) return null;
  return [{ height: `${from}px` }, { height: `${to}px` }];
}

export const canAnimate = (element: Element): boolean =>
  !prefersReducedMotionNow() && typeof element.animate === 'function';
