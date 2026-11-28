import clsx from 'clsx';
import { Check } from 'lucide-react';
import {
  useCallback,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { isPhoneNow } from '../../lib/media';
import {
  FloatingPanel,
  FloatingPortal,
  type PlaceContext,
  type PlaceFloating,
} from '../FloatingPanel';
import { Icon } from '../Icon';
import styles from './Dropdown.module.css';
import { placeMenu } from './placeMenu';

export interface DropdownOption<T extends string = string> {
  value: T;
  label: string;
  icon?: ReactNode;
  // The whole label on hover, where a long one is cut.
  title?: string | undefined;
}

export interface DropdownProps<T extends string = string> {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  label: string;
  options: readonly DropdownOption<T>[];
  value: T | null | undefined;
  onSelect: (value: T) => void;
  onClose: () => void;
}

export function Dropdown<T extends string>(props: DropdownProps<T>) {
  return (
    <FloatingPortal open={props.open}>
      <Menu {...props} />
    </FloatingPortal>
  );
}

function Menu<T extends string>({
  open,
  anchorRef,
  label,
  options,
  value,
  onSelect,
  onClose,
}: DropdownProps<T>) {
  const menuRef = useRef<HTMLDivElement>(null);
  const itemCount = options.length;
  const place = useCallback<PlaceFloating>(
    (anchor, menu, context) => position(menu, anchor, itemCount, context),
    [itemCount],
  );

  useLayoutEffect(() => {
    const buttons = menuRef.current ? optionButtons(menuRef.current) : [];
    const selected = buttons.find((button) => button.getAttribute('aria-selected') === 'true');
    (selected ?? buttons[0])?.focus();
  }, []);

  const close = () => {
    anchorRef.current?.focus({ preventScroll: true });
    onClose();
  };

  const choose = (next: T) => {
    onSelect(next);
    close();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const buttons = menuRef.current ? optionButtons(menuRef.current) : [];
    const index = buttons.findIndex((button) => button === document.activeElement);
    if (event.key === 'Escape' || event.key === 'Tab') {
      // Marked as handled so a parent sheet listening for Escape stays open.
      if (event.key === 'Escape') event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const option = options[index];
      if (option) choose(option.value);
      return;
    }

    const next = nextIndex(event.key, index, buttons.length);
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
      aria-label={label}
      data-dropdown=""
      className={styles.menu}
      onKeyDown={onKeyDown}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="option"
          aria-selected={option.value === value}
          tabIndex={-1}
          title={option.title}
          className={clsx('ring-inside', styles.option)}
          onPointerMove={focusUnderMouse}
          onClick={() => choose(option.value)}
        >
          {option.icon !== undefined && <span className={styles.optionIcon}>{option.icon}</span>}
          <span className={styles.optionLabel}>{option.label}</span>
          {option.value === value && <Icon icon={Check} className={styles.check} />}
        </button>
      ))}
    </FloatingPanel>
  );
}

function position(menu: HTMLElement, anchor: DOMRect, itemCount: number, context: PlaceContext) {
  const place = placeMenu({
    triggerRect: anchor,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    itemCount,
    isPhone: isPhoneNow(),
    ...context,
  });
  menu.style.width = `${place.width}px`;
  menu.style.maxHeight = `${place.maxHeight}px`;

  return place;
}

// A mouse moving over a row takes the highlight with it, as only the focused row is highlighted.
function focusUnderMouse(event: PointerEvent<HTMLElement>) {
  const row = event.currentTarget;
  if (event.pointerType === 'mouse' && row !== document.activeElement) {
    row.focus({ preventScroll: true });
  }
}

function optionButtons(menu: HTMLElement): HTMLElement[] {
  return Array.from(menu.querySelectorAll<HTMLElement>('[role="option"]'));
}

function nextIndex(key: string, index: number, count: number): number | null {
  if (count === 0) return null;
  switch (key) {
    case 'ArrowDown':
      return index < 0 || index >= count - 1 ? 0 : index + 1;
    case 'ArrowUp':
      return index <= 0 ? count - 1 : index - 1;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}
