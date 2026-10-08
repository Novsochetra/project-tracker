import { useEffect, type RefObject } from 'react';
import { useLatest } from '../lib/useLatest';
import { createSwipeDown, type SwipeDownContext } from './swipeDown';

export function useSwipeDown(ref: RefObject<HTMLElement | null>, context: SwipeDownContext): void {
  const contextRef = useLatest(context);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const swipe = createSwipeDown(() => contextRef.current);
    element.addEventListener('pointerdown', swipe.down);
    element.addEventListener('pointermove', swipe.move);
    element.addEventListener('pointerup', swipe.up);
    element.addEventListener('pointercancel', swipe.up);
    return () => {
      element.removeEventListener('pointerdown', swipe.down);
      element.removeEventListener('pointermove', swipe.move);
      element.removeEventListener('pointerup', swipe.up);
      element.removeEventListener('pointercancel', swipe.up);
    };
  }, [ref, contextRef]);
}
