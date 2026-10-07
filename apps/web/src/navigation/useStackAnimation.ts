import type { MotionValue } from 'motion/react';
import { useLayoutEffect } from 'react';
import { DURATION } from '../design/motion';
import { EASE_IOS, EASE_OUT, tween, type Bezier } from '../gestures/animation';
import { progressRange, type Platform, type StackAnimation } from './stackMotion';

export interface StackTiming {
  durationMs: number;
  ease: Bezier;
}

export const PHONE_SLIDE: StackTiming = { durationMs: 460, ease: EASE_IOS };
export const DESKTOP_FADE: StackTiming = { durationMs: DURATION.base, ease: EASE_OUT };

export const stackTiming = (platform: Platform, animation: StackAnimation): StackTiming =>
  platform === 'phone' && (animation === 'push' || animation === 'pop')
    ? PHONE_SLIDE
    : DESKTOP_FADE;

export interface StackAnimationInput {
  id: number;
  animation: StackAnimation;
  platform: Platform;
  progress: MotionValue<number>;
  onSettled: (id: number) => void;
}

export function useStackAnimation({
  id,
  animation,
  platform,
  progress,
  onSettled,
}: StackAnimationInput) {
  useLayoutEffect(() => {
    if (animation === 'none' || animation === 'swipe') return;
    const [from, to] = progressRange(platform, animation);
    progress.set(from);
    return tween(progress, to, stackTiming(platform, animation), () => onSettled(id));
  }, [id, animation, platform, progress, onSettled]);
}
