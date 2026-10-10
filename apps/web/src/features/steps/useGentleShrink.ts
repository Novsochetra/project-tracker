import { useLayoutEffect, useRef, type RefObject } from 'react';
import { DURATION, EASE } from '../../design/motion';
import { prefersReducedMotionNow } from '../../lib/media';
import { shrinkFrames } from './gentleShrink';

const EASE_OUT = `cubic-bezier(${EASE.out.join(', ')})`;

export function useGentleShrink(ref: RefObject<HTMLElement | null>, change: unknown): void {
  const height = useRef<number | null>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const next = element.getBoundingClientRect().height;
    const frames = shrinkFrames(height.current, next);
    height.current = next;
    if (!frames || prefersReducedMotionNow() || typeof element.animate !== 'function') return;
    element.animate(frames, { duration: DURATION.base, easing: EASE_OUT });
  }, [ref, change]);
}
