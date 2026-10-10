import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { isAtEnd, scrollParent } from './followEnd';

// New steps keep the newest in sight only for someone already at the end: one who scrolled up to
// read an earlier step stays where they are. Growth fires no scroll event, so `atEnd` still says
// where the person left the scroller when the next step lands.
export function useFollowEnd(ref: RefObject<HTMLElement | null>, change: unknown): void {
  const atEnd = useRef(true);
  useEffect(() => {
    const scroller = scrollParent(ref.current);
    if (!scroller) return undefined;
    const onScroll = () => {
      atEnd.current = isAtEnd(scroller);
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [ref]);
  useLayoutEffect(() => {
    const scroller = scrollParent(ref.current);
    if (scroller && atEnd.current) scroller.scrollTop = scroller.scrollHeight;
  }, [ref, change]);
}
