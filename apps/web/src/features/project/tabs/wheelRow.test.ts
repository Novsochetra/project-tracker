import { describe, expect, it } from 'vitest';
import { bufferWheel, EMPTY_BUFFER, rowScrollFor, type RowWheel } from './wheelRow';

const row = (scrollLeft: number) => ({ scrollLeft, scrollWidth: 500, clientWidth: 200 });
const wheel = (deltaY: number, more: Partial<RowWheel> = {}): RowWheel => ({
  deltaX: 0,
  deltaY,
  deltaMode: 0,
  clientX: 0,
  clientY: 0,
  ctrlKey: false,
  ...more,
});

describe('rowScrollFor', () => {
  it('scrolls the row right for the wheel down and left for the wheel up', () => {
    expect(rowScrollFor(row(100), wheel(100))).toBe(100);
    expect(rowScrollFor(row(100), wheel(-100))).toBe(-100);
  });

  it('counts lines and pages as Firefox reports them', () => {
    expect(rowScrollFor(row(100), wheel(3, { deltaMode: 1 }))).toBe(48);
    expect(rowScrollFor(row(100), wheel(1, { deltaMode: 2 }))).toBe(200);
  });

  it('gives the wheel back to the page at either end of the row', () => {
    expect(rowScrollFor(row(0.5), wheel(-100))).toBeNull();
    expect(rowScrollFor(row(299.5), wheel(100))).toBeNull();
    expect(rowScrollFor({ scrollLeft: 0, scrollWidth: 200, clientWidth: 200 }, wheel(100))).toBe(
      null,
    );
  });

  it('leaves sideways swipes and pinch zoom alone', () => {
    expect(rowScrollFor(row(100), wheel(10, { deltaX: 40 }))).toBeNull();
    expect(rowScrollFor(row(100), wheel(10, { ctrlKey: true }))).toBeNull();
  });
});

describe('bufferWheel', () => {
  it('scrolls at once for a mouse wheel step', () => {
    expect(bufferWheel(EMPTY_BUFFER, 100, 1000).scroll).toBe(100);
    expect(bufferWheel(EMPTY_BUFFER, -48, 1000).scroll).toBe(-48);
  });

  it("adds up a trackpad's small deltas into one step", () => {
    let buffer = EMPTY_BUFFER;
    const scrolls: Array<number | null> = [];
    for (let at = 0; at < 160; at += 16) {
      const next = bufferWheel(buffer, 4, at);
      buffer = next.buffer;
      scrolls.push(next.scroll);
    }
    expect(scrolls.filter((scroll) => scroll !== null)).toEqual([40]);
  });

  it('starts over after a pause or a change of direction', () => {
    const waiting = bufferWheel(EMPTY_BUFFER, 30, 0).buffer;
    expect(bufferWheel(waiting, 30, 100).scroll).toBe(60);
    expect(bufferWheel(waiting, 30, 400).scroll).toBeNull();
    expect(bufferWheel(waiting, -30, 100)).toEqual({
      buffer: { delta: -30, at: 100 },
      scroll: null,
    });
  });
});
