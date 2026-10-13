import type { RefObject } from 'react';
import { flushSync } from 'react-dom';
import { useOptionalScreen } from '../../navigation';
import { revealGroupTop } from './revealGroup';

// Collapsing measures the group once it has shrunk, in the same task, so the screen never paints
// what lay below the group before scrolling back to it.
export function useGroupToggle(
  groupRef: RefObject<HTMLElement | null>,
  expanded: boolean,
  toggle: () => void,
): () => void {
  const scrollRef = useOptionalScreen()?.scrollRef;
  return () => {
    if (!expanded) return toggle();
    flushSync(toggle);
    const group = groupRef.current;
    const scroller = scrollRef?.current;
    if (group && scroller) revealGroupTop(group, scroller);
  };
}
