import { useEffect, type RefObject } from 'react';

const FOCUSABLE = 'button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]';

const triggerOf = (anchorRef: RefObject<HTMLElement | null>): HTMLElement | null => {
  const trigger = anchorRef.current?.firstElementChild;
  return trigger instanceof HTMLElement ? trigger : null;
};

export function useCloseOnEscape(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      triggerOf(anchorRef)?.focus();
      onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, anchorRef, onClose]);
}

function moveTab(event: KeyboardEvent, trigger: HTMLElement, items: HTMLElement[]) {
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) return;
  if (event.target === trigger && !event.shiftKey) {
    event.preventDefault();
    first.focus();
  } else if (event.target === first && event.shiftKey) {
    event.preventDefault();
    trigger.focus();
  } else if (event.target === last && !event.shiftKey) {
    // Not prevented: the browser's own Tab then goes on from the trigger to what follows it.
    trigger.focus();
  }
}

// The menu sits in a body portal, so it stays above a sheet one of its items opens; Tab still goes
// from the trigger into the menu and back out to the page after the trigger.
export function useMenuTabOrder(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const trigger = triggerOf(anchorRef);
      const panel = panelRef.current;
      if (event.key !== 'Tab' || event.defaultPrevented || !trigger || !panel) return;
      moveTab(event, trigger, [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)]);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, anchorRef, panelRef]);
}
