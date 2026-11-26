const SCROLLS = new Set(['auto', 'scroll']);

// What scrolls a thing is whatever holds it: a screen, or a sheet's body.
export function scrollParent(element: Element | null): HTMLElement | null {
  for (let node = element?.parentElement; node; node = node.parentElement) {
    if (SCROLLS.has(getComputedStyle(node).overflowY)) return node;
  }

  return null;
}
