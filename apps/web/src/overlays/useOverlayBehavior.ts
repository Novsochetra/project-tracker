import { useCallback, useLayoutEffect, useRef, type KeyboardEvent, type RefObject } from 'react';
import { trapTab } from './focus';
import { isTopOverlay, pushOverlay } from './overlayStack';
import { lockBodyScroll } from './scrollLock';

export interface OverlayBehavior {
  active: boolean;
  panelRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
  focusInitial: boolean;
}

function listenForEscape(token: symbol, onClose: () => void): () => void {
  const onKeyDown = (event: globalThis.KeyboardEvent) => {
    if (event.key !== 'Escape' || event.defaultPrevented || !isTopOverlay(token)) return;
    event.preventDefault();
    onClose();
  };
  // On window, so handlers on the dialog, its portals and the document all get Escape first.
  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}

export function useOverlayBehavior(behavior: OverlayBehavior) {
  const { active, panelRef, initialFocusRef, focusInitial } = behavior;
  const onCloseRef = useRef(behavior.onClose);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const sessionRef = useRef<{ superseded: boolean } | null>(null);
  useLayoutEffect(() => {
    onCloseRef.current = behavior.onClose;
  });

  useLayoutEffect(() => {
    if (!active) return;
    if (sessionRef.current) sessionRef.current.superseded = true;
    const session = { superseded: false };
    sessionRef.current = session;
    const focused = document.activeElement;
    // A re-run (StrictMode, platform switch) must not adopt the panel as the place to return to.
    if (focused instanceof HTMLElement && !panelRef.current?.contains(focused)) {
      returnFocusRef.current = focused;
    }
    const initial = focusInitial ? initialFocusRef?.current : null;
    (initial ?? panelRef.current)?.focus({ preventScroll: true });
    const token = Symbol('overlay');
    const pop = pushOverlay(token);
    const unlock = lockBodyScroll();
    const stopEscape = listenForEscape(token, () => onCloseRef.current());
    return () => {
      stopEscape();
      unlock();
      pop();
      // Layout cleanups run before React restores the pre-commit focus, so wait for the commit,
      // and skip it when the overlay was activated again in the meantime.
      queueMicrotask(() => {
        const target = returnFocusRef.current;
        if (!session.superseded && target?.isConnected) {
          target.focus({ preventScroll: true });
        }
      });
    };
  }, [active, panelRef, initialFocusRef, focusInitial]);

  return useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (panelRef.current) trapTab(event.nativeEvent, panelRef.current);
    },
    [panelRef],
  );
}
