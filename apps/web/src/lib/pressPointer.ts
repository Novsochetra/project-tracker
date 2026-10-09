import { useEffect, useRef, type RefObject } from 'react';

interface Press {
  pointerType: string;
  on: Element;
}

type PressEvent = Pick<PointerEvent, 'pointerType' | 'button'>;

export interface Presses {
  // A pointerdown on `on`, the element whose clicks are asked about.
  press: (event: PressEvent, on: Element) => void;
  // The pointer of the press that the click being handled comes from, if any.
  pointer: () => string | null;
  forget: () => void;
  stop: () => void;
}

// Not every browser's click says which pointer made it (WebKit calls a finger's click "mouse"), so
// the pointerdown before it tells. A press can end without a click: dragged off, a sheet dragged
// down, taken by a scroll. Its pointer must not stand for a later click that has none, such as
// VoiceOver's (PT-97). A press released off the element makes no click on it and a cancelled one
// none at all, so they are forgotten at once; one released on it makes its click there, and the
// click forgets it. A timer after the pointerup forgot them before: a busy page could take a later
// click first (PT-106), and a finger's click can come a task after it lifts (Chromium). A finger's
// pointerup lands where it went down, wherever it lifts, since that element keeps its pointer.
// Only the primary button's press makes a click: a right-click opens a menu and makes none, so
// it was kept until the next click and lent it its pointer (PT-115). A Mac's ctrl+click is the
// primary button's but opens the menu too, and Chromium sends no click for it, so a press that
// opens a context menu is forgotten (PT-130).
export function followPresses(): Presses {
  let current: Press | null = null;
  const forget = () => {
    current = null;
  };
  const release = ({ target }: Event) => {
    if (!(target instanceof Node && current?.on.contains(target))) forget();
  };
  const ends = [
    ['pointerup', release],
    ['pointercancel', forget],
    ['contextmenu', forget],
  ] as const;
  ends.forEach(([type, end]) => window.addEventListener(type, end, true));
  return {
    press: ({ pointerType, button }, on) => {
      if (button === 0) current = { pointerType, on };
    },
    pointer: () => current?.pointerType ?? null,
    forget,
    stop: () => ends.forEach(([type, end]) => window.removeEventListener(type, end, true)),
  };
}

// followPresses for as long as the component is on the page.
export function usePresses(): RefObject<Presses | null> {
  const presses = useRef<Presses | null>(null);
  useEffect(() => {
    const followed = followPresses();
    presses.current = followed;
    return followed.stop;
  }, []);
  return presses;
}
