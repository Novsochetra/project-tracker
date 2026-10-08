import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';
import { DURATION } from '../../design/motion';
import { prefersReducedMotionNow } from '../../lib/media';
import { useLatest } from '../../lib/useLatest';
import { placePopover } from './placePopover';

export interface PickerPresence {
  mounted: boolean;
  session: number;
}

// Keeps the popover while it plays its exit. Opening again starts a new session, a fresh calendar
// on the chosen day, instead of reviving the one that is leaving.
export function usePickerPresence(open: boolean): PickerPresence {
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
      prefersReducedMotionNow() ? 0 : DURATION.fast,
    );
    return () => window.clearTimeout(timer);
  }, [leaving]);
  return { mounted: state.mounted, session: state.session };
}

export function usePopoverPlacement(
  panelRef: RefObject<HTMLElement | null>,
  anchorRef: RefObject<HTMLElement | null>,
) {
  useLayoutEffect(() => {
    const place = () => {
      const panel = panelRef.current;
      const anchor = anchorRef.current;
      if (!panel || !anchor) return;
      const root = document.documentElement;
      const placement = placePopover({
        anchor: anchor.getBoundingClientRect(),
        size: { width: panel.offsetWidth, height: panel.offsetHeight },
        viewport: { width: root.clientWidth, height: root.clientHeight },
      });
      panel.style.top = `${placement.top}px`;
      panel.style.left = `${placement.left}px`;
      panel.style.transformOrigin = `${placement.originX}px ${placement.up ? '100%' : '0'}`;
      panel.dataset.up = String(placement.up);
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [panelRef, anchorRef]);
}

const TABBABLE = 'button:not([disabled]):not([tabindex="-1"])';

// A modal dialog keeps Tab inside it; this one lives in a body portal, past the end of the page.
function keepTabInside(event: KeyboardEvent, panel: HTMLElement) {
  const items = Array.from(panel.querySelectorAll<HTMLElement>(TABBABLE));
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) return;
  const active = document.activeElement;
  if (event.shiftKey && (active === first || active === panel)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || active === panel)) {
    event.preventDefault();
    first.focus();
  }
}

export function useDialogKeys(panelRef: RefObject<HTMLElement | null>, onEscape: () => void) {
  const escape = useLatest(onEscape);
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Handled here, so a sheet behind the calendar stays open.
        event.preventDefault();
        escape.current();
      } else if (event.key === 'Tab') {
        keepTabInside(event, panel);
      }
    };
    panel.addEventListener('keydown', onKeyDown);
    return () => panel.removeEventListener('keydown', onKeyDown);
  }, [panelRef, escape]);
}

const SCROLL_GRACE_MS = 300;

// Like the dropdowns (SPEC §5.5): the page moving under the popover would leave it off its row.
export function useCloseOnScroll(
  panelRef: RefObject<HTMLElement | null>,
  active: boolean,
  onClose: () => void,
) {
  const close = useLatest(onClose);
  useEffect(() => {
    if (!active) return;
    const openedAt = performance.now();
    const onScroll = (event: Event) => {
      if (performance.now() - openedAt < SCROLL_GRACE_MS) return;
      if (event.target instanceof Node && panelRef.current?.contains(event.target)) return;
      close.current();
    };
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [panelRef, active, close]);
}
