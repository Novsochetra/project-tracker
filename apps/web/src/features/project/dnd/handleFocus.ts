export const HANDLE_ATTRIBUTE = 'data-handle-for';

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

// React may move or remount a row when a keyboard move shows, and again when a refused move goes
// back, which drops focus; the handle takes it back until the returned function is called.
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

export function rowHasFocus(ticketId: string): boolean {
  return (
    document.activeElement?.closest<HTMLElement>('[data-drop-row]')?.dataset.dropRow === ticketId
  );
}
