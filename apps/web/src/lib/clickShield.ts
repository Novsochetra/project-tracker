import { useCallback, useLayoutEffect, useRef, type MouseEvent } from 'react';

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
