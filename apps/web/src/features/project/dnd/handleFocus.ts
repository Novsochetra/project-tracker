// Every drag handle carries its ticket id in this attribute (see DragHandle).
const HANDLE_ATTRIBUTE = 'data-handle-for';

let pending: { ticketId: string } | null = null;

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
 * A keyboard move re-renders the row when it shows and again when a refused move goes back, and
 * React may move or remount the row's DOM node, which drops focus. The handle takes focus back on
 * its renders until the move is over: call the returned function then.
 */
export function requestHandleFocus(ticketId: string): () => void {
  const request = { ticketId };
  pending = request;
  document.addEventListener('focusin', forgetUnlessHandle, true);
  document.addEventListener('pointerdown', forgetUnlessHandle, true);
  return () => {
    if (pending === request) clearHandleFocus();
  };
}

export function wantsHandleFocus(ticketId: string): boolean {
  return pending?.ticketId === ticketId;
}
