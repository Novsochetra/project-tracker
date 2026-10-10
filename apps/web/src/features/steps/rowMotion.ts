import { DURATION, EASE } from '../../design/motion';
import { prefersReducedMotionNow } from '../../lib/media';

// Ease-in, like a sheet going: what folds away starts slow, and ease-in is steepest at its end,
// 1.67 times its mean speed. Ease-out moved a row 46px in its first frame.
const EASE_IN = `cubic-bezier(${EASE.in.join(', ')})`;
const STEEPEST = 1 / (1 - EASE.in[0]);
const FRAME_MS = 1000 / 60;
const FRAME_PX = 24;

// As long as it takes for no frame to move more than FRAME_PX at 60 fps, never shorter than the
// base: the helper's longest text step (2000 characters, about 1,300px at 375) takes about 1.5 s.
export function foldMotion(px: number): KeyframeAnimationOptions {
  const duration = Math.max((px * STEEPEST * FRAME_MS) / FRAME_PX, DURATION.base);
  return { duration, easing: EASE_IN };
}

export const canAnimate = (element: Element): boolean =>
  !prefersReducedMotionNow() && typeof element.animate === 'function';
