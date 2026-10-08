import clsx from 'clsx';
import { useRef, type ReactNode } from 'react';
import { FloatingPanel, FloatingPortal, placeFloating, type PlaceFloating } from '../FloatingPanel';
import { useCloseOnEscape, useMenuTabOrder } from './menuKeys';
import styles from './Popover.module.css';

export interface PopoverProps {
  open: boolean;
  onClose: () => void;
  trigger: ReactNode;
  children: ReactNode;
  'aria-label'?: string;
  className?: string | undefined;
}

// SPEC §5.4: right-aligned with its button and 6px below it.
const placeMenu: PlaceFloating = (anchor, panel) =>
  placeFloating({
    anchor,
    size: { width: panel.offsetWidth, height: panel.offsetHeight },
    viewport: {
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
    },
    gap: 6,
    inset: 0,
  });

export function Popover({
  open,
  onClose,
  trigger,
  children,
  'aria-label': label,
  className,
}: PopoverProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useCloseOnEscape(open, anchorRef, onClose);
  useMenuTabOrder(open, anchorRef, panelRef, onClose);
  return (
    <div ref={anchorRef} className={clsx(styles.anchor, className)}>
      {trigger}
      <FloatingPortal open={open}>
        <FloatingPanel
          open={open}
          anchorRef={anchorRef}
          panelRef={panelRef}
          closeLabel="Close menu"
          place={placeMenu}
          onClose={onClose}
          role="group"
          aria-label={label}
          className={styles.panel}
        >
          {children}
        </FloatingPanel>
      </FloatingPortal>
    </div>
  );
}
