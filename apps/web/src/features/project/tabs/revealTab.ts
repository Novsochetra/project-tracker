import { prefersReducedMotionNow } from '../../../lib/media';

export interface TrackMetrics {
  scrollLeft: number;
  width: number;
  maxScroll: number;
  inset: number;
}

export interface TabSpan {
  start: number;
  end: number;
}

// Scrolling on high-density screens rests on fractions of a pixel.
const TOLERANCE = 1;

function revealTarget(track: TrackMetrics, tab: TabSpan, starts: readonly number[]) {
  const own = tab.start - track.inset;
  if (own < track.scrollLeft - TOLERANCE) return own;
  const needed = tab.end + track.inset - track.width;
  if (needed <= track.scrollLeft + TOLERANCE) return null;
  const snap = starts.map((start) => start - track.inset).find((left) => left >= needed);
  return Math.min(snap ?? track.maxScroll, own);
}

// Stops where a tab starts: the row snaps to those points, so stopping between them would let the
// snap move on and cut the tab off again.
export function revealLeft(
  track: TrackMetrics,
  tab: TabSpan,
  starts: readonly number[],
): number | null {
  const left = revealTarget(track, tab, starts);
  return left === null ? null : Math.min(Math.max(left, 0), track.maxScroll);
}

export const tabScrollBehavior = (): ScrollBehavior =>
  prefersReducedMotionNow() ? 'instant' : 'smooth';

export const tabButtons = (track: HTMLElement): HTMLElement[] => [
  ...track.querySelectorAll<HTMLElement>(':scope > button'),
];

export const pressedTab = (track: HTMLElement): HTMLElement | undefined =>
  tabButtons(track).find((tab) => tab.getAttribute('aria-pressed') === 'true');

export function revealTab(track: HTMLElement, tab: HTMLElement, behavior: ScrollBehavior): void {
  const starts = tabButtons(track).map((button) => button.offsetLeft);
  const metrics: TrackMetrics = {
    scrollLeft: track.scrollLeft,
    width: track.clientWidth,
    maxScroll: track.scrollWidth - track.clientWidth,
    // The first tab starts at the track's padding, which is also its scroll padding.
    inset: starts[0] ?? 0,
  };
  const span = { start: tab.offsetLeft, end: tab.offsetLeft + tab.offsetWidth };
  const left = revealLeft(metrics, span, starts);
  if (left !== null) track.scrollTo({ left, behavior });
}
