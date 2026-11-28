import {
  useCallback,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
} from 'react';
import {
  FloatingPanel,
  FloatingPortal,
  placeFloating,
  type PlaceContext,
  type PlaceFloating,
} from '../../components/FloatingPanel';
import { LabelPicker } from './LabelPicker';
import styles from './LabelMenu.module.css';
import { steadyPlacement, type OpenedAt } from './steadyPlacement';
import type { LabelPickerInput } from './useLabelPicker';

export interface LabelMenuProps extends LabelPickerInput {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onManage?: (() => void) | undefined;
}

export const PICKER_LABEL = 'Pick labels';

export function LabelMenu(props: LabelMenuProps) {
  return (
    <FloatingPortal open={props.open}>
      <Menu {...props} />
    </FloatingPortal>
  );
}

// The field and about three labels: less room than this and the menu covers part of its row.
const MIN_HEIGHT = 160;

// Sized by what it holds, measured, not guessed from a count of rows: a guess left the empty
// state's two lines cut under the field (PT-286). Its max-height is the room placement gives it
// on its side (inside the sheet where it fits), so typing may grow it up to that, and the
// ResizeObserver places it again; the list itself shows 7.5 labels at most.
function placeLabelMenu(anchor: DOMRect, menu: HTMLElement, context: PlaceContext) {
  menu.style.maxHeight = 'none';
  const exactHeight = parseFloat(getComputedStyle(menu).height);
  const size = { width: menu.offsetWidth, height: menu.offsetHeight };
  const viewport = {
    width: document.documentElement.clientWidth,
    height: document.documentElement.clientHeight,
  };
  const spot = placeFloating({
    ...context,
    anchor,
    size,
    viewport,
    minHeight: Math.min(size.height, MIN_HEIGHT),
  });
  menu.style.maxHeight = `${spot.room}px`;

  // Its exact height, not the rounded one, so the field's edge stays on the same fraction of a
  // pixel as the rows change (steadyPlacement).
  return { ...spot, height: Math.min(exactHeight || size.height, spot.room) };
}

// Above its row the field comes last, next to the row, so the menu grows and shrinks upward as
// typing changes its rows while the field stays put.
function useSteadyPlace() {
  const [up, setUp] = useState(false);
  const openedRef = useRef<OpenedAt | null>(null);
  const place = useCallback<PlaceFloating>((anchor, menu, context) => {
    const steady = steadyPlacement(
      placeLabelMenu(anchor, menu, context),
      anchor.top,
      openedRef.current,
    );
    openedRef.current = steady.opened;
    setUp(steady.placement.up);

    return steady.placement;
  }, []);

  return { up, place };
}

// Clicks on the menu's padding or a note leave focus in the field, so typing goes on.
const keepFieldFocus = (event: MouseEvent) => {
  if (!(event.target instanceof HTMLInputElement)) event.preventDefault();
};

// A ticket has several labels: a pick toggles one and the menu stays open for the next.
function Menu({ open, anchorRef, onClose, ...picker }: LabelMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { up, place } = useSteadyPlace();
  const close = () => {
    anchorRef.current?.focus({ preventScroll: true });
    onClose();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' && event.key !== 'Tab') return;

    // Marked as handled so a parent sheet listening for Escape stays open.
    if (event.key === 'Escape') event.preventDefault();
    event.stopPropagation();
    close();
  };

  return (
    <FloatingPanel
      open={open}
      anchorRef={anchorRef}
      panelRef={menuRef}
      closeLabel="Close menu"
      place={place}
      onClose={close}
      role="dialog"
      aria-label={PICKER_LABEL}
      data-dropdown=""
      className={styles.menu}
      onKeyDown={onKeyDown}
      onMouseDown={keepFieldFocus}
    >
      <LabelPicker layout="list" focusField fieldLast={up} {...picker} />
    </FloatingPanel>
  );
}
