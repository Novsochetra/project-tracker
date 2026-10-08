import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { asksForCapture, isCaptureShortcut, withoutCaptureParam } from './captureTriggers';

const OPEN_OVERLAY = '[aria-modal="true"], [role="listbox"]';

/** C opens quick capture from anywhere, unless a text field, sheet or menu has the keyboard. */
export function useCaptureShortcut(openCapture: () => void, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isCaptureShortcut(event, document.activeElement)) return;
      if (document.querySelector(OPEN_OVERLAY)) return;
      // Otherwise the letter lands in the title field, which has focus by the time it is typed.
      event.preventDefault();
      openCapture();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openCapture, enabled]);
}

/** `?capture` (the app shortcut's link) opens quick capture once, then leaves the address clean. */
export function useCaptureLink(openCapture: () => void): void {
  const { key, pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  const handledKey = useRef<string | null>(null);
  const requested = asksForCapture(search);
  useEffect(() => {
    if (!requested || handledKey.current === key) return;
    handledKey.current = key;
    openCapture();
    void navigate({ pathname, search: withoutCaptureParam(search), hash }, { replace: true });
  }, [requested, key, pathname, search, hash, navigate, openCapture]);
}
