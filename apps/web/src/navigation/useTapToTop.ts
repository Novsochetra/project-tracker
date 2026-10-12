import { useCallback, type RefCallback } from 'react';
import { useOptionalScreen } from './ScreenContext';
import { scrollScreenToTop } from './scrollToTop';

const CONTROLS = 'a, button, input, select, textarea';

function scrollToTop(scroller: HTMLElement, target: EventTarget | null): void {
  if (target instanceof Element && target.closest(CONTROLS)) return;
  scrollScreenToTop(scroller);
}

// A bigger target than the status bar (useStatusBarTap), and one that works off iOS too. A native
// listener keeps the header a landmark rather than a control: the tap is a pointer shortcut, and
// the keyboard has Home in the scroller.
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
