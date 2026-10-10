import { useLayoutEffect } from 'react';
import { useScreen } from '../../navigation';

// A chat reads from its end: the newest answer and the composer under it.
export function useScrollToEnd(change: string): void {
  const { scrollRef } = useScreen();
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [scrollRef, change]);
}
