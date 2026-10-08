import { useEffect, type RefObject } from 'react';
import { wheelPixels, type WheelLike } from '../../../components/FloatingPanel';

export interface RowScroll {
  scrollLeft: number;
  scrollWidth: number;
  clientWidth: number;
}

export type RowWheel = WheelLike & { ctrlKey: boolean };

// Scrolling on high-density screens rests on fractions of a pixel.
const TOLERANCE = 1;

// A mouse wheel only turns up and down, so over a row too long for its space it scrolls the row,
// until the row's end, where the page takes over again. Sideways swipes and pinch zoom are the
// browser's own.
export function rowScrollFor(row: RowScroll, wheel: RowWheel): number | null {
  if (wheel.ctrlKey || Math.abs(wheel.deltaX) >= Math.abs(wheel.deltaY)) return null;
  const { y } = wheelPixels(wheel, row.clientWidth);
  const room = row.scrollWidth - row.clientWidth;
  const canMove = y < 0 ? row.scrollLeft > TOLERANCE : row.scrollLeft < room - TOLERANCE;
  return canMove ? y : null;
}

export interface WheelBuffer {
  delta: number;
  at: number;
}

export const EMPTY_BUFFER: WheelBuffer = { delta: 0, at: -Infinity };

// Under a Firefox wheel step of 3 lines (48px), so one step still moves the row.
const STEP = 40;
const PAUSE_MS = 250;

// The row snaps to tab starts, so even a 1px scroll moves it a whole tab; a trackpad's many small
// deltas add up to a step first, or a short swipe would race through every tab.
export function bufferWheel(buffer: WheelBuffer, y: number, now: number) {
  const fresh = now - buffer.at > PAUSE_MS || Math.sign(buffer.delta) !== Math.sign(y);
  const delta = (fresh ? 0 : buffer.delta) + y;
  if (Math.abs(delta) < STEP) return { buffer: { delta, at: now }, scroll: null };
  return { buffer: { delta: 0, at: now }, scroll: delta };
}

// React's wheel listeners are passive, and only an active one can keep the page from scrolling.
export function useWheelScrollsRow(rowRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    let buffer = EMPTY_BUFFER;
    const onWheel = (event: WheelEvent) => {
      const y = rowScrollFor(row, event);
      if (y === null) return;
      event.preventDefault();
      const next = bufferWheel(buffer, y, event.timeStamp);
      buffer = next.buffer;
      if (next.scroll !== null) row.scrollBy({ left: next.scroll });
    };
    row.addEventListener('wheel', onWheel, { passive: false });
    return () => row.removeEventListener('wheel', onWheel);
  }, [rowRef]);
}
