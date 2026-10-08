const CONTROLS = 'a[href], button, input, select, textarea, [tabindex]';

const after = (element: Element, candidate: Element): boolean => {
  const position = element.compareDocumentPosition(candidate);
  return (
    (position & Node.DOCUMENT_POSITION_FOLLOWING) !== 0 &&
    (position & Node.DOCUMENT_POSITION_CONTAINED_BY) === 0
  );
};

// The first control after `element` in reading order that takes focus: a hidden, disabled or
// inert one doesn't, so it is passed over.
export function focusAfter(element: Element): void {
  for (const candidate of document.querySelectorAll<HTMLElement>(CONTROLS)) {
    if (candidate.tabIndex < 0 || !after(element, candidate)) continue;
    candidate.focus();
    if (document.activeElement === candidate) return;
  }
}
