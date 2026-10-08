import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  type MouseEvent,
  type PointerEvent,
} from 'react';

// Longer than a 160ms exit and than a double-click or double tap, whose second press can come
// 200ms or more after the first (like the toast's TOAST_SHIELD_MS).
export const CLICK_SHIELD_MS = 500;

// A click from the keyboard (detail 0) is deliberate, so only a pointer's is held back.
export const isShielded = (detail: number, shownAt: number | null, now: number): boolean =>
  detail !== 0 && (shownAt === null || now - shownAt < CLICK_SHIELD_MS);

// What appears where a tap or click just was would take the second press of a double tap or
// double-click there. So for CLICK_SHIELD_MS after it appears, or after `shown` changes, the
// handler drops presses from a pointer; preventing the mousedown also leaves focus where it was.
export function useClickShield(shown?: unknown): (event: MouseEvent) => void {
  const shownAt = useRef<number | null>(null);
  useLayoutEffect(() => {
    shownAt.current = performance.now();
  }, [shown]);
  return useCallback((event: MouseEvent) => {
    if (!isShielded(event.detail, shownAt.current, performance.now())) return;
    event.preventDefault();
    event.stopPropagation();
  }, []);
}

// A mouse's single click lands where the person aimed it. A double-click's later clicks, a touch or
// pen tap and a click with no pointer before it (VoiceOver's) can land on what just arrived there.
export const isAimedClick = (pointerType: string | null, detail: number): boolean =>
  pointerType === 'mouse' && detail === 1;

// Like useClickShield, but a mouse's single click goes through at once: on desktop, an action sheet
// such as Discard changes ignored a click aimed at it for 500 ms. Not every browser's click says
// which pointer made it, so the pointerdown before it tells.
export function useTapShield(shown?: unknown) {
  const shield = useClickShield(shown);
  const pointerType = useRef<string | null>(null);
  return useMemo(() => {
    const hold = (event: MouseEvent) => {
      if (!isAimedClick(pointerType.current, event.detail)) shield(event);
    };
    return {
      onPointerDownCapture: (event: PointerEvent) => {
        pointerType.current = event.pointerType;
      },
      onMouseDownCapture: hold,
      onClickCapture: (event: MouseEvent) => {
        hold(event);
        pointerType.current = null;
      },
    };
  }, [shield]);
}
