import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { isAtEnd, scrollParent } from './followEnd';

interface Watched {
  scroller: HTMLElement;
  stop: () => void;
}

function watch(scroller: HTMLElement, atEnd: { current: boolean }): Watched {
  const onScroll = () => {
    atEnd.current = isAtEnd(scroller);
  };
  scroller.addEventListener('scroll', onScroll, { passive: true });
  return { scroller, stop: () => scroller.removeEventListener('scroll', onScroll) };
}

// New steps keep the newest in sight only for someone already at the end: one who scrolled up to
// read an earlier step stays where they are. Growth fires no scroll event, so `atEnd` still says
// where the person left the scroller when the next step lands. The scroller is looked up after
// every render, since a sheet that turns from phone to desktop puts the steps in a new one.
export function useFollowEnd(ref: RefObject<HTMLElement | null>, change: unknown): void {
  const atEnd = useRef(true);
  const watched = useRef<Watched | null>(null);
  useLayoutEffect(() => {
    const scroller = scrollParent(ref.current);
    if (watched.current?.scroller === scroller) return;
    watched.current?.stop();
    watched.current = scroller ? watch(scroller, atEnd) : null;
  });
  useEffect(() => () => watched.current?.stop(), []);
  useLayoutEffect(() => {
    const scroller = scrollParent(ref.current);
    if (scroller && atEnd.current) scroller.scrollTop = scroller.scrollHeight;
  }, [ref, change]);
}
