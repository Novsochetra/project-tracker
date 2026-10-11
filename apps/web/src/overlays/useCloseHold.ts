import { useLayoutEffect, useMemo, useRef, type MouseEvent } from 'react';
import { holdPresses } from '../lib/holdPresses';
import { closedByClick } from './closeHold';

// A closing sheet takes no taps, so the second tap of a double tap on what closed it (Close,
// Cancel, a primary action, the scrim or Discard changes) landed on the screen it uncovers: the nav
// bar's Back, or a field, which opened the keyboard (PT-148). So when a pointer's click on the
// sheet closes it, at once or after a short request like Run's, the whole page holds presses for
// CLICK_SHIELD_MS. A swipe-down and Escape hold nothing: neither is a click a second tap could
// follow, so the next tap is aimed and goes through as before. Each press or key forgets the click
// before it, so only the sheet's last input counts.
export function useCloseHold(open: boolean) {
  const clickedAt = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (open) return;
    if (closedByClick(clickedAt.current, performance.now())) holdPresses(document.body);
    clickedAt.current = null;
  }, [open]);
  return useMemo(() => {
    const forget = () => {
      clickedAt.current = null;
    };
    return {
      onPointerDownCapture: forget,
      onKeyDownCapture: forget,
      onClickCapture: (event: MouseEvent) => {
        clickedAt.current = event.detail === 0 ? null : performance.now();
      },
    };
  }, []);
}
