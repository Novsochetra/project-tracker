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
import { HoldCloseProvider, useCloseLayer } from './closeHold';
import {
  useCloseOnScroll,
  useFloatingPlacement,
  useFloatingPresence,
  type PlaceFloating,
} from './floatingHooks';
import styles from './FloatingPanel.module.css';
import { scrollUnder } from './scrollUnder';

// In a body portal, so the panel's frame lies above any sheet, also one an item in it opens, and
// can take the second click of a double-click there.
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

// One base for the dropdowns, the calendar and the ••• menus, so they all close, move and take a
// double-click's second click the same way.
export function FloatingPanel({
  open,
  anchorRef,
  panelRef,
  closeLabel,
  place,
  onClose,
  className,
  children,
  ...panelProps
}: FloatingPanelProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  useFloatingPlacement(frameRef, panelRef, anchorRef, place);
  useCloseOnScroll(panelRef, open, onClose);
  const { hold, ...layer } = useCloseLayer(onClose);
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
          {...layer}
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
        >
          <HoldCloseProvider value={hold}>{children}</HoldCloseProvider>
        </div>
      </div>
    </>
  );
}
