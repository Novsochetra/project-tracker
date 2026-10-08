export const HANDLE_FOCUS_MS = 1000;

// Every drag handle carries its ticket id in this attribute (see DragHandle).
const HANDLE_ATTRIBUTE = 'data-handle-for';

let pending: { ticketId: string; until: number } | null = null;

// Focus or a press anywhere else means the person moved on: stop pulling focus back.
function forgetUnlessHandle(event: Event): void {
  const handle =
    event.target instanceof Element ? event.target.closest(`[${HANDLE_ATTRIBUTE}]`) : null;
  if (handle?.getAttribute(HANDLE_ATTRIBUTE) !== pending?.ticketId) clearHandleFocus();
}

export function clearHandleFocus(): void {
  pending = null;
  document.removeEventListener('focusin', forgetUnlessHandle, true);
  document.removeEventListener('pointerdown', forgetUnlessHandle, true);
}

/**
 * A keyboard move re-renders the row, and React may move or remount its DOM node, which drops
 * focus. The handle takes focus back on its next renders while the request is fresh.
 */
export function requestHandleFocus(ticketId: string, now: number = performance.now()): void {
  pending = { ticketId, until: now + HANDLE_FOCUS_MS };
  document.addEventListener('focusin', forgetUnlessHandle, true);
  document.addEventListener('pointerdown', forgetUnlessHandle, true);
}

export function wantsHandleFocus(ticketId: string, now: number = performance.now()): boolean {
  if (pending && now > pending.until) clearHandleFocus();
  return pending?.ticketId === ticketId;
}
