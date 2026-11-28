import { useRef, type KeyboardEvent, type MouseEvent, type RefObject } from 'react';
import {
  FloatingPanel,
  FloatingPortal,
  placeFloating,
  type PlaceFloating,
} from '../../components/FloatingPanel';
import { LabelPicker } from './LabelPicker';
import styles from './LabelMenu.module.css';
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
// state's two lines cut under the field (PT-286). It may then grow into all the room on its side
// as typing changes the rows, and the ResizeObserver places it again.
const placeLabelMenu: PlaceFloating = (anchor, menu, context) => {
  menu.style.maxHeight = 'none';
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

  return spot;
};

// Clicks on the menu's padding or a note leave focus in the field, so typing goes on.
const keepFieldFocus = (event: MouseEvent) => {
  if (!(event.target instanceof HTMLInputElement)) event.preventDefault();
};

// A ticket has several labels: a pick toggles one and the menu stays open for the next.
function Menu({ open, anchorRef, onClose, ...picker }: LabelMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
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
      place={placeLabelMenu}
      onClose={close}
      role="dialog"
      aria-label={PICKER_LABEL}
      data-dropdown=""
      className={styles.menu}
      onKeyDown={onKeyDown}
      onMouseDown={keepFieldFocus}
    >
      <LabelPicker layout="list" focusField {...picker} />
    </FloatingPanel>
  );
}
