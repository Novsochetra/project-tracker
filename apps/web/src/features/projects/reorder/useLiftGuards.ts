import { useEffect, type RefObject } from 'react';

export type TouchLift = 'holding' | 'lifted' | null;

// While a row is lifted the finger drags it, so its touchmoves neither scroll the list nor reach
// pull to refresh, which listens above it. The listeners stay for the list's life: Chrome decides
// when a touch begins whether its moves can be cancelled, from the listeners there then.
export function useLiftGuards(
  list: RefObject<HTMLElement | null>,
  lift: RefObject<TouchLift>,
  enabled: boolean,
): void {
  useEffect(() => {
    const element = list.current;
    if (!element || !enabled) return;

    const onMove = (event: TouchEvent) => {
      if (lift.current !== 'lifted') return;

      if (event.cancelable) event.preventDefault();
      event.stopPropagation();
    };

    // A resting finger opens Android's long-press menu and starts selecting text.
    const onMenu = (event: Event) => {
      if (lift.current) event.preventDefault();
    };

    element.addEventListener('touchmove', onMove, { passive: false });
    element.addEventListener('contextmenu', onMenu);

    return () => {
      element.removeEventListener('touchmove', onMove);
      element.removeEventListener('contextmenu', onMenu);
    };
  }, [enabled, lift, list]);
}
