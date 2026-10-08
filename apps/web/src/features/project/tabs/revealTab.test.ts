import { describe, expect, it } from 'vitest';
import { revealLeft, type TrackMetrics } from './revealTab';

// Six tabs in a 200px track with 2px padding: the content is 500px wide, so it scrolls 300px.
const spans = [
  { start: 2, end: 58 },
  { start: 60, end: 138 },
  { start: 140, end: 228 },
  { start: 230, end: 328 },
  { start: 330, end: 418 },
  { start: 420, end: 498 },
];
const starts = spans.map((span) => span.start);
const track = (scrollLeft: number, width = 200): TrackMetrics => ({
  scrollLeft,
  width,
  maxScroll: 500 - width,
  inset: 2,
});
const reveal = (index: number, at: TrackMetrics) => revealLeft(at, spans[index]!, starts);

describe('revealLeft', () => {
  it('leaves a tab that already shows whole where it is', () => {
    expect(reveal(0, track(0))).toBeNull();
    expect(reveal(1, track(0))).toBeNull();
    expect(reveal(4, track(300))).toBeNull();
  });

  it('brings a tab cut off on the right in, stopping where a tab starts (a snap point)', () => {
    expect(reveal(2, track(0))).toBe(58);
    expect(reveal(3, track(0))).toBe(138);
    expect(reveal(4, track(0))).toBe(228);
  });

  it('stops at the end of the row for the last tab', () => {
    expect(reveal(5, track(0))).toBe(300);
    expect(reveal(5, track(140))).toBe(300);
  });

  it('brings a tab cut off on the left in at the start of the row', () => {
    expect(reveal(2, track(300))).toBe(138);
    expect(reveal(0, track(120))).toBe(0);
  });

  it('shows the start of a tab wider than the row', () => {
    expect(reveal(3, track(0, 100))).toBe(228);
  });

  it('ignores less than a pixel, which high-density screens leave after scrolling', () => {
    expect(reveal(1, track(58.5))).toBeNull();
    expect(reveal(2, track(29.4))).toBeNull();
  });
});
