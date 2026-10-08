import { useLayoutEffect, useRef, type RefObject } from 'react';
import { pressedTab, revealTab, tabScrollBehavior } from './revealTab';

export function useRevealPressed(trackRef: RefObject<HTMLElement | null>, value: string): void {
  const shownRef = useRef(false);
  useLayoutEffect(() => {
    const track = trackRef.current;
    const pressed = track && pressedTab(track);
    if (track && pressed) {
      revealTab(track, pressed, shownRef.current ? tabScrollBehavior() : 'instant');
    }
    shownRef.current = true;
  }, [trackRef, value]);
}
