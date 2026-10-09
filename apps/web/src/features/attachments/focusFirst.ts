const CONTROLS = 'a[href], button, input, select, textarea, [tabindex]';

const after = (element: Element, candidate: Element): boolean => {
  const position = element.compareDocumentPosition(candidate);
  return (
    (position & Node.DOCUMENT_POSITION_FOLLOWING) !== 0 &&
    (position & Node.DOCUMENT_POSITION_CONTAINED_BY) === 0
  );
};

// The controls after `element` in reading order, found while it is still in the page.
export const controlsAfter = (element: Element): HTMLElement[] =>
  [...document.querySelectorAll<HTMLElement>(CONTROLS)].filter(
    (candidate) => candidate.tabIndex >= 0 && after(element, candidate),
  );

// Focuses the first that takes it: one gone from the page, hidden, disabled or inert doesn't.
export function focusFirst(candidates: readonly (HTMLElement | null | undefined)[]): void {
  for (const candidate of candidates) {
    if (!candidate?.isConnected) continue;
    candidate.focus();
    if (document.activeElement === candidate) return;
  }
}
