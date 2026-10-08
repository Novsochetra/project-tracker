import { useEffect, useLayoutEffect, type RefObject } from 'react';
import { pressedTab, tabButtons } from './revealTab';

function placeThumb(track: HTMLElement, thumb: HTMLElement): void {
  const pressed = pressedTab(track);
  if (!pressed) return;
  thumb.style.setProperty('--thumb-x', `${pressed.offsetLeft}px`);
  thumb.style.setProperty('--thumb-width', `${pressed.offsetWidth}px`);
  if (thumb.hasAttribute('data-placed')) return;
  // The first place is styled before the transition turns on, so the thumb doesn't spring in from
  // the left edge when the row appears.
  void getComputedStyle(thumb).transform;
  thumb.setAttribute('data-placed', '');
}

// Only places the thumb: its CSS transition does the spring, which the reduced-motion rule covers.
export function useTabThumb(
  trackRef: RefObject<HTMLElement | null>,
  thumbRef: RefObject<HTMLElement | null>,
  tabsKey: string,
): void {
  useLayoutEffect(() => {
    if (trackRef.current && thumbRef.current) placeThumb(trackRef.current, thumbRef.current);
  });
  useEffect(() => {
    const track = trackRef.current;
    const thumb = thumbRef.current;
    if (!track || !thumb || typeof ResizeObserver === 'undefined') return;
    // Web fonts arriving and the phone row's width resize tabs without rendering this component.
    const observer = new ResizeObserver(() => placeThumb(track, thumb));
    observer.observe(track);
    tabButtons(track).forEach((tab) => observer.observe(tab));
    return () => observer.disconnect();
  }, [trackRef, thumbRef, tabsKey]);
}
