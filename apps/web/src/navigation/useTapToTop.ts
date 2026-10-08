import { useCallback, type RefCallback } from 'react';
import { prefersReducedMotionNow } from '../lib/media';
import { useOptionalScreen } from './ScreenContext';

const CONTROLS = 'a, button, input, select, textarea';

function scrollToTop(scroller: HTMLElement, target: EventTarget | null): void {
  if (target instanceof Element && target.closest(CONTROLS)) return;
  scroller.scrollTo({ top: 0, behavior: prefersReducedMotionNow() ? 'instant' : 'smooth' });
}

// iOS's tap-the-top only scrolls the document, which never scrolls here, so the nav bar does it
// for the screen's scroller. A native listener keeps the header a landmark rather than a control:
// the tap is a pointer shortcut, and the keyboard has Home in the scroller.
export function useTapToTop(): RefCallback<HTMLElement> {
  const scrollRef = useOptionalScreen()?.scrollRef;
  return useCallback(
    (bar: HTMLElement | null) => {
      if (!bar || !scrollRef) return;
      const onClick = (event: MouseEvent) => {
        if (scrollRef.current) scrollToTop(scrollRef.current, event.target);
      };
      bar.addEventListener('click', onClick);
      return () => bar.removeEventListener('click', onClick);
    },
    [scrollRef],
  );
}
