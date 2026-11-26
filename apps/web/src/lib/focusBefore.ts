const FOCUSABLE = 'button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]';

// For what is about to leave the screen with focus in it: the closest thing before it on the same
// screen takes focus, so a keyboard user carries on from there rather than from the page's top.
export function focusBefore(leaving: Element): void {
  const screen = leaving.closest('[data-stack-scroller]') ?? leaving.ownerDocument.body;
  const before = [...screen.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (candidate) =>
      !leaving.contains(candidate) &&
      (candidate.compareDocumentPosition(leaving) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
  );
  before.at(-1)?.focus();
}
