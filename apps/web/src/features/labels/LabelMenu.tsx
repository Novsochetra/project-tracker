import { sortLabels, type Label } from '@tracker/shared';
import clsx from 'clsx';
import { Check } from 'lucide-react';
import { useCallback, useLayoutEffect, useRef, type KeyboardEvent, type RefObject } from 'react';
import { Icon, placeMenu } from '../../components';
import dropdown from '../../components/Dropdown/Dropdown.module.css';
import { FloatingPanel, FloatingPortal, type PlaceFloating } from '../../components/FloatingPanel';
import { isPhoneNow } from '../../lib/media';
import { LabelDot } from './LabelDot';
import { nextOptionIndex, toggled } from './labelMenuKeys';

export interface LabelMenuProps {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  labels: readonly Label[];
  value: readonly string[];
  onChange: (labelIds: string[]) => void;
  onClose: () => void;
}

// The dropdown's look, but a ticket has several labels: a pick toggles one and the menu stays
// open for the next.
export function LabelMenu(props: LabelMenuProps) {
  return (
    <FloatingPortal open={props.open}>
      <Menu {...props} />
    </FloatingPortal>
  );
}

const optionButtons = (menu: HTMLElement | null): HTMLElement[] =>
  menu ? Array.from(menu.querySelectorAll<HTMLElement>('[role="option"]')) : [];

function placeLabelMenu(menu: HTMLElement, anchor: DOMRect, itemCount: number) {
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const spot = placeMenu({ triggerRect: anchor, viewport, itemCount, isPhone: isPhoneNow() });
  menu.style.width = `${spot.width}px`;
  menu.style.maxHeight = `${spot.maxHeight}px`;
  return spot;
}

function Menu({ open, anchorRef, labels, value, onChange, onClose }: LabelMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const sorted = sortLabels(labels);
  const count = labels.length;
  const place = useCallback<PlaceFloating>(
    (anchor, menu) => placeLabelMenu(menu, anchor, count),
    [count],
  );
  useLayoutEffect(() => optionButtons(menuRef.current)[0]?.focus(), []);
  const close = () => {
    anchorRef.current?.focus({ preventScroll: true });
    onClose();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const buttons = optionButtons(menuRef.current);
    const index = buttons.findIndex((button) => button === document.activeElement);
    if (event.key === 'Escape' || event.key === 'Tab') {
      // Marked as handled so a parent sheet listening for Escape stays open.
      if (event.key === 'Escape') event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    const next = nextOptionIndex(event.key, index, buttons.length);
    if (next === null) return;
    event.preventDefault();
    buttons[next]?.focus();
  };
  return (
    <FloatingPanel
      open={open}
      anchorRef={anchorRef}
      panelRef={menuRef}
      closeLabel="Close menu"
      place={place}
      onClose={close}
      role="listbox"
      aria-label="Labels"
      aria-multiselectable="true"
      data-dropdown=""
      className={dropdown.menu}
      onKeyDown={onKeyDown}
    >
      {sorted.map((label) => {
        const selected = value.includes(label.id);
        return (
          <button
            key={label.id}
            type="button"
            role="option"
            aria-selected={selected}
            tabIndex={-1}
            className={clsx('ring-inside', dropdown.option)}
            onClick={() => onChange(toggled(value, label.id))}
          >
            <span className={dropdown.optionIcon}>
              <LabelDot color={label.color} />
            </span>
            <span className={dropdown.optionLabel}>{label.name}</span>
            {selected && <Icon icon={Check} className={dropdown.check} />}
          </button>
        );
      })}
    </FloatingPanel>
  );
}
