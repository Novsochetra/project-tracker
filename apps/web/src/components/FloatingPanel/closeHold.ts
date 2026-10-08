import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  type MouseEvent,
} from 'react';
import { isShielded } from '../../lib/clickShield';

const HoldClose = createContext<() => void>(() => undefined);

export const HoldCloseProvider = HoldClose.Provider;

// What a click turns the panel into can be smaller than what it replaced (Delete project's confirm
// is shorter than the menu), so the second click of a double-click lands beside it, on the layer
// that closes the panel. While held, that layer takes such clicks without closing, for
// CLICK_SHIELD_MS like the confirm's own buttons. Only after a hold: a click outside a panel that
// just opened still closes it at once.
export function useCloseLayer(onClose: () => void) {
  const heldAt = useRef<number | null>(null);
  const hold = useCallback(() => {
    heldAt.current = performance.now();
  }, []);
  const isHeld = (event: MouseEvent) =>
    heldAt.current !== null && isShielded(event.detail, heldAt.current, performance.now());
  return {
    hold,
    // Focus stays on what the panel's new step focused.
    onMouseDown: (event: MouseEvent) => {
      if (isHeld(event)) event.preventDefault();
    },
    onClick: (event: MouseEvent) => {
      if (!isHeld(event)) onClose();
    },
  };
}

// For a panel's step that appears where the click that asked for it was.
export function useHoldCloseOnShow(): void {
  const hold = useContext(HoldClose);
  useLayoutEffect(hold, [hold]);
}
