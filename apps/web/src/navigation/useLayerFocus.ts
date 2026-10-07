import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

const isTextField = (element: Element): boolean =>
  element instanceof HTMLTextAreaElement ||
  (element instanceof HTMLInputElement &&
    element.type !== 'checkbox' &&
    element.type !== 'radio') ||
  (element instanceof HTMLElement && element.isContentEditable);

function focusLost(): boolean {
  const active = document.activeElement;
  return !active || active === document.body || active.closest('[inert]') !== null;
}

/**
 * After a navigation the old screen turns inert and takes focus with it. Coming back, return to
 * what was focused there (like VoiceOver returning to the tapped row); otherwise focus the screen.
 * Text fields are skipped so going back never pops the keyboard up.
 */
export function useLayerFocus(
  layerRef: RefObject<HTMLElement | null>,
  scrollRef: RefObject<HTMLElement | null>,
  isTop: boolean,
  navigated: boolean,
): void {
  const lastFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const remember = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement) lastFocusRef.current = event.target;
    };
    layer.addEventListener('focusin', remember);
    return () => layer.removeEventListener('focusin', remember);
  }, [layerRef]);

  useLayoutEffect(() => {
    if (!isTop || !navigated || !focusLost()) return;
    const last = lastFocusRef.current;
    const target = last?.isConnected && !isTextField(last) ? last : scrollRef.current;
    target?.focus({ preventScroll: true });
  }, [isTop, navigated, scrollRef]);
}
