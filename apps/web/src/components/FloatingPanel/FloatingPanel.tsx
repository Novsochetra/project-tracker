import clsx from 'clsx';
import {
  useRef,
  type ComponentPropsWithoutRef,
  type MouseEvent,
  type ReactNode,
  type RefObject,
  type WheelEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  useCloseOnScroll,
  useFloatingPlacement,
  useFloatingPresence,
  type PlaceFloating,
} from './floatingHooks';
import styles from './FloatingPanel.module.css';
import { scrollUnder } from './scrollUnder';

// Mounts the panel in a body portal while it is open, leaving or shielding a double-click.
export function FloatingPortal({ open, children }: { open: boolean; children: ReactNode }) {
  const { mounted, session } = useFloatingPresence(open);
  if (!mounted) return null;
  return createPortal(children, document.body, String(session));
}

export interface FloatingPanelProps extends ComponentPropsWithoutRef<'div'> {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  panelRef: RefObject<HTMLDivElement | null>;
  closeLabel: string;
  place: PlaceFloating;
  onClose: () => void;
}

const keepFocus = (event: MouseEvent) => event.preventDefault();

// The panel of the dropdowns and the calendar: placed at its row, closed by a click outside, the
// wheel or a page scroll, with the menu motion in and out.
export function FloatingPanel({
  open,
  anchorRef,
  panelRef,
  closeLabel,
  place,
  onClose,
  className,
  ...panelProps
}: FloatingPanelProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  useFloatingPlacement(frameRef, panelRef, anchorRef, place);
  useCloseOnScroll(panelRef, open, onClose);
  const leaving = !open;
  const onWheel = (event: WheelEvent<HTMLButtonElement>) => {
    if (event.ctrlKey) return;
    scrollUnder(event.currentTarget, event);
    onClose();
  };
  return (
    <>
      {open && (
        <button
          type="button"
          tabIndex={-1}
          aria-label={closeLabel}
          className={styles.layer}
          onClick={onClose}
          onWheel={onWheel}
        />
      )}
      {/* While the panel leaves, its frame takes the second click of a double-click there, and
          keeps focus where closing put it; it adds no meaning of its own. */}
      <div
        ref={frameRef}
        role="presentation"
        className={styles.frame}
        onMouseDown={leaving ? keepFocus : undefined}
      >
        <div
          ref={panelRef}
          tabIndex={-1}
          {...panelProps}
          aria-hidden={leaving || undefined}
          inert={leaving}
          data-leaving={leaving || undefined}
          className={clsx(styles.panel, className)}
        />
      </div>
    </>
  );
}
