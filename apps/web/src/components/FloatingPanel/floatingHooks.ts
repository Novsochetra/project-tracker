import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { CLICK_SHIELD_MS } from '../../lib/clickShield';
import { useLatest } from '../../lib/useLatest';
import type { FloatingPlacement, FloatingSide, VerticalBounds } from './placeFloating';

export interface FloatingPresence {
  mounted: boolean;
  session: number;
}

// Keeps a closed panel for its exit and for the second click of a double-click. Opening again
// starts a new session, a fresh panel, instead of reviving the one that is leaving.
export function useFloatingPresence(open: boolean): FloatingPresence {
  const [state, setState] = useState({ open, mounted: open, session: 0 });
  if (open !== state.open) {
    setState({
      open,
      mounted: open || state.mounted,
      session: open ? state.session + 1 : state.session,
    });
  }

  const leaving = state.mounted && !open;
  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(
      () => setState((current) => ({ ...current, mounted: current.open })),
      CLICK_SHIELD_MS,
    );

    return () => window.clearTimeout(timer);
  }, [leaving]);

  return { mounted: state.mounted, session: state.session };
}

export type PanelPosition = Pick<FloatingPlacement, 'top' | 'left' | 'up' | 'originX'>;

export interface PlaceContext {
  container: VerticalBounds | undefined;
  side: FloatingSide | undefined;
}

export type PlaceFloating = (
  anchor: DOMRect,
  panel: HTMLElement,
  context: PlaceContext,
) => PanelPosition;

// The sheet a row sits in, which its panel stays inside where it fits.
const containerOf = (anchor: HTMLElement): DOMRect | undefined =>
  anchor.closest('[role="dialog"]')?.getBoundingClientRect();

export function useFloatingPlacement(
  frameRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
  anchorRef: RefObject<HTMLElement | null>,
  place: PlaceFloating,
) {
  const sideRef = useRef<FloatingSide | undefined>(undefined);
  useLayoutEffect(() => {
    const apply = () => {
      const frame = frameRef.current;
      const panel = panelRef.current;
      const anchor = anchorRef.current;
      if (!frame || !panel || !anchor) return;

      const context = { container: containerOf(anchor), side: sideRef.current };
      const placement = place(anchor.getBoundingClientRect(), panel, context);
      sideRef.current = placement.up ? 'up' : 'down';
      frame.style.top = `${placement.top}px`;
      frame.style.left = `${placement.left}px`;
      panel.style.transformOrigin = `${placement.originX}px ${placement.up ? '100%' : '0'}`;
      panel.dataset.up = String(placement.up);
    };

    apply();
    window.addEventListener('resize', apply);
    // A ••• menu that turns into its delete confirm changes size, and one above its button must
    // grow away from it.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(apply);
    if (panelRef.current) observer?.observe(panelRef.current);

    return () => {
      window.removeEventListener('resize', apply);
      observer?.disconnect();
    };
  }, [frameRef, panelRef, anchorRef, place]);
}

const SCROLL_GRACE_MS = 300;

const placeOf = (anchor: HTMLElement | null): string => {
  const rect = anchor?.getBoundingClientRect();

  return rect ? `${rect.top},${rect.left}` : '';
};

// SPEC §5.5: the page moving under the panel would leave it off its row, so it closes once a
// scroll has moved its anchor. Scrolls that leave the anchor in place don't count (PT-292): a row
// of tabs revealing its tab as the screen loads, the panel's own list, and on iOS the page resting
// 1px down for status-bar taps under the sticky app. Scrolls in the first 300ms come from opening
// it, like focus bringing its row into view, so the anchor's place is taken again then.
export function useCloseOnScroll(
  anchorRef: RefObject<HTMLElement | null>,
  active: boolean,
  onClose: () => void,
) {
  const close = useLatest(onClose);
  useEffect(() => {
    if (!active) return;
    const openedAt = performance.now();
    let placed = placeOf(anchorRef.current);
    const onScroll = () => {
      const place = placeOf(anchorRef.current);
      if (performance.now() - openedAt < SCROLL_GRACE_MS) {
        placed = place;
        return;
      }

      if (place !== placed || !place) close.current();
    };

    window.addEventListener('scroll', onScroll, true);

    return () => window.removeEventListener('scroll', onScroll, true);
  }, [anchorRef, active, close]);
}
