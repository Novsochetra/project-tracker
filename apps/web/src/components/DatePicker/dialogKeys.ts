import { useEffect, type RefObject } from 'react';
import { useLatest } from '../../lib/useLatest';

const TABBABLE = 'button:not([disabled]):not([tabindex="-1"])';

// A modal dialog keeps Tab inside it; this one lives in a body portal, past the end of the page.
function keepTabInside(event: KeyboardEvent, panel: HTMLElement) {
  const items = Array.from(panel.querySelectorAll<HTMLElement>(TABBABLE));
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) return;
  const active = document.activeElement;
  if (event.shiftKey && (active === first || active === panel)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || active === panel)) {
    event.preventDefault();
    first.focus();
  }
}

export function useDialogKeys(panelRef: RefObject<HTMLElement | null>, onEscape: () => void) {
  const escape = useLatest(onEscape);
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Handled here, so a sheet behind the calendar stays open.
        event.preventDefault();
        escape.current();
      } else if (event.key === 'Tab') {
        keepTabInside(event, panel);
      }
    };
    panel.addEventListener('keydown', onKeyDown);
    return () => panel.removeEventListener('keydown', onKeyDown);
  }, [panelRef, escape]);
}
