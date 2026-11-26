import { useCallback, useRef, type KeyboardEvent, type RefObject } from 'react';
import { placeMenu } from '../../components';
import dropdown from '../../components/Dropdown/Dropdown.module.css';
import { FloatingPanel, FloatingPortal, type PlaceFloating } from '../../components/FloatingPanel';
import { isPhoneNow } from '../../lib/media';
import { LabelPicker } from './LabelPicker';
import type { LabelPickerInput } from './useLabelPicker';

export interface LabelMenuProps extends LabelPickerInput {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onManage?: (() => void) | undefined;
}

export const PICKER_LABEL = 'Pick labels';

// The dropdown's look, but a ticket has several labels: a pick toggles one and the menu stays
// open for the next.
export function LabelMenu(props: LabelMenuProps) {
  return (
    <FloatingPortal open={props.open}>
      <Menu {...props} />
    </FloatingPortal>
  );
}

// The field and a Create row sit above and below the labels.
const EXTRA_ROWS = 2;

function placeLabelMenu(menu: HTMLElement, anchor: DOMRect, itemCount: number) {
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const spot = placeMenu({ triggerRect: anchor, viewport, itemCount, isPhone: isPhoneNow() });
  menu.style.width = `${spot.width}px`;
  menu.style.maxHeight = `${spot.maxHeight}px`;
  return spot;
}

function Menu({ open, anchorRef, onClose, ...picker }: LabelMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const count = picker.labels.length + EXTRA_ROWS;
  const place = useCallback<PlaceFloating>(
    (anchor, menu) => placeLabelMenu(menu, anchor, count),
    [count],
  );
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
      className={dropdown.menu}
      onKeyDown={onKeyDown}
    >
      <LabelPicker layout="list" focusField {...picker} />
    </FloatingPanel>
  );
}
