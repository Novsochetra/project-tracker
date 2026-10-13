import type { RefObject } from 'react';
import { flushSync } from 'react-dom';
import { useOptionalScreen } from '../../navigation';
import { revealGroupTop } from './revealGroup';

export interface GroupToggleRefs {
  // The element at the group's top: once collapsed it is back in its place.
  top: RefObject<HTMLElement | null>;
  footer: RefObject<HTMLButtonElement | null>;
}

// The header's Show less goes with the expanded group; focus on it would fall to the page.
function keepFocus(focused: Element | null, footer: HTMLButtonElement | null): void {
  if (focused && focused !== document.body && !focused.isConnected) footer?.focus();
}

// Collapsing measures the group once it has shrunk, in the same task, so the screen never paints
// what lay below the group before scrolling back to it.
export function useGroupToggle(
  refs: GroupToggleRefs,
  expanded: boolean,
  toggle: () => void,
): () => void {
  const scrollRef = useOptionalScreen()?.scrollRef;
  return () => {
    if (!expanded) return toggle();
    const focused = document.activeElement;
    flushSync(toggle);
    const top = refs.top.current;
    const scroller = scrollRef?.current;
    if (top && scroller) revealGroupTop(top, scroller);
    keepFocus(focused, refs.footer.current);
  };
}
