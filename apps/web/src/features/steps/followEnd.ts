// A finger rarely stops exactly at the end, and a step that just landed may sit a few pixels past it.
export const FOLLOW_SLACK_PX = 40;

export interface ScrollBox {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

export const isAtEnd = ({ scrollTop, scrollHeight, clientHeight }: ScrollBox): boolean =>
  scrollHeight - scrollTop - clientHeight <= FOLLOW_SLACK_PX;

const SCROLLS = new Set(['auto', 'scroll']);

// The steps scroll with whatever holds them: the chat's screen, or a sheet's body.
export function scrollParent(element: Element | null): HTMLElement | null {
  for (let node = element?.parentElement; node; node = node.parentElement) {
    if (SCROLLS.has(getComputedStyle(node).overflowY)) return node;
  }
  return null;
}
