import { useEffect, type RefObject } from 'react';

// Like a UIKit bar's scroll edge: the sheet's bar blends into the sheet until content scrolls
// under it, then shows its line. An attribute, not state, so scrolling never re-renders the sheet.
export function useScrollEdge(
  scroller: RefObject<HTMLElement | null>,
  marked: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    const body = scroller.current;
    const panel = marked.current;
    if (!body || !panel) return;

    const update = () => panel.toggleAttribute('data-scrolled', body.scrollTop > 0);
    update();
    body.addEventListener('scroll', update, { passive: true });

    return () => body.removeEventListener('scroll', update);
  }, [scroller, marked]);
}
