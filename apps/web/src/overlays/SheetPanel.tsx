import clsx from 'clsx';
import { motion } from 'motion/react';
import {
  useCallback,
  useRef,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { useKeyboardInset } from '../gestures/useKeyboardInset';
import { useTopPull } from '../gestures/useTopPull';
import { useAxisDrag } from '../gestures/useAxisDrag';
import { usePrefersReducedMotion } from '../lib/media';
import { DiscardChangesSheet } from './DiscardChangesSheet';
import styles from './Sheet.module.css';
import { SheetCancelContext } from './sheetCancel';
import type { SheetProps } from './sheetTypes';
import { useCloseHold } from './useCloseHold';
import { useDialogPresence, useDialogValues } from './useDialogPresence';
import { useDiscardGuard } from './useDiscardGuard';
import { useDismissDrag } from './useDismissDrag';
import { useOverlayBehavior } from './useOverlayBehavior';
import { useBottomPanelValues, useSlidePresence } from './useSlidePresence';

export interface SheetPanelProps extends SheetProps {
  isPhone: boolean;
  onExited: () => void;
}

function useKeyboardVars(enabled: boolean): CSSProperties | undefined {
  const { inset, viewportHeight } = useKeyboardInset();
  if (!enabled || viewportHeight === 0) return undefined;
  return {
    '--sheet-keyboard': `${inset}px`,
    '--sheet-viewport': `${viewportHeight}px`,
  } as CSSProperties;
}

interface SheetContentProps extends SheetPanelProps {
  handleRef: RefObject<HTMLDivElement | null>;
  bodyRef: RefObject<HTMLDivElement | null>;
  bodyScrolls: boolean;
}

function SheetContent(props: SheetContentProps): ReactNode {
  const { isPhone, left, title, subtitle, right, children, footer, handleRef, bodyRef } = props;
  const bodyTabIndex = props.bodyScrolls ? -1 : undefined;
  return (
    <>
      <div ref={handleRef} className={styles.handle}>
        {isPhone && (
          <div className={styles.grabber} aria-hidden="true">
            <span />
          </div>
        )}
        <header className={styles.header}>
          <div className={styles.start}>{left}</div>
          <div className={styles.heading}>
            <span className={styles.title}>{title}</span>
            {subtitle !== undefined && <span className={styles.subtitle}>{subtitle}</span>}
          </div>
          <div className={styles.end}>{right}</div>
        </header>
      </div>
      <div ref={bodyRef} className={styles.body} tabIndex={bodyTabIndex}>
        {children}
      </div>
      {footer !== undefined && <div className={styles.footer}>{footer}</div>}
    </>
  );
}

function useSheetMotion(
  props: SheetPanelProps,
  panelRef: RefObject<HTMLDivElement | null>,
  onDismiss: () => void,
) {
  const { open, isPhone, onExited } = props;
  const reducedMotion = usePrefersReducedMotion();
  const releaseVelocityRef = useRef(0);
  const bottom = useBottomPanelValues();
  const dialog = useDialogValues();
  const measureTravel = useCallback(() => panelRef.current?.offsetHeight ?? null, [panelRef]);
  useSlidePresence({
    enabled: isPhone,
    open,
    reducedMotion,
    values: bottom,
    measureTravel,
    releaseVelocityRef,
    onExited,
  });
  useDialogPresence({ enabled: !isPhone, open, reducedMotion, values: dialog, onExited });
  const drag = useDismissDrag({
    enabled: isPhone && open,
    open,
    y: bottom.y,
    travel: bottom.travel,
    measureTravel,
    releaseVelocityRef,
    onClose: onDismiss,
  });
  const panelStyle = isPhone
    ? { y: bottom.y, opacity: bottom.opacity }
    : { y: dialog.y, scale: dialog.scale, opacity: dialog.opacity };
  return { drag, panelStyle, scrim: isPhone ? bottom.scrim : dialog.scrim };
}

// Keeps focus on the field being typed in, so Keep editing can hand it back.
const keepFocus = (event: MouseEvent) => event.preventDefault();

export function SheetPanel(props: SheetPanelProps) {
  const { open, onClose, label, size = 'form', isPhone, initialFocusRef, onSubmit } = props;
  const panelRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const keyboardVars = useKeyboardVars(isPhone);
  const guard = useDiscardGuard(open, props.dirty ?? false, onClose);
  const { drag, panelStyle, scrim } = useSheetMotion(props, panelRef, guard.requestClose);
  useAxisDrag(handleRef, { ...drag, axis: 'y' });
  useTopPull(bodyRef, drag);
  // A wide desktop sheet scrolls in its body, not the panel, so the body takes first focus for
  // Page Down and the arrow keys to scroll it.
  const bodyScrolls = !isPhone && size === 'wide';
  const trapKeys = useOverlayBehavior({
    active: open,
    panelRef,
    onClose: guard.requestClose,
    initialFocusRef: initialFocusRef ?? (bodyScrolls ? bodyRef : undefined),
    focusInitial: !isPhone,
  });
  // iOS asks before Cancel throws changes away; a desktop Cancel button is a deliberate click.
  const cancel = isPhone ? guard.requestClose : onClose;
  const closeHold = useCloseHold(open);

  const content = (
    <SheetContent {...props} handleRef={handleRef} bodyRef={bodyRef} bodyScrolls={bodyScrolls} />
  );
  return (
    <SheetCancelContext.Provider value={cancel}>
      <div
        className={clsx(styles.overlay, styles[size], isPhone ? styles.phone : styles.desktop)}
        style={keyboardVars}
        inert={!open}
        data-sheet=""
        {...closeHold}
      >
        <motion.button
          type="button"
          tabIndex={-1}
          aria-label="Close"
          className={styles.scrim}
          style={{ opacity: scrim }}
          onMouseDown={keepFocus}
          onClick={guard.requestClose}
        />
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          tabIndex={-1}
          className={styles.panel}
          style={panelStyle}
          onKeyDown={trapKeys}
        >
          {onSubmit ? (
            <form className={styles.sheetForm} onSubmit={onSubmit} noValidate>
              {content}
            </form>
          ) : (
            content
          )}
        </motion.div>
        {/* Inside, though it opens on the body, so a press on Discard changes counts as the sheet's. */}
        <DiscardChangesSheet
          open={guard.asking}
          onKeep={guard.keepEditing}
          onDiscard={guard.discard}
        />
      </div>
    </SheetCancelContext.Provider>
  );
}
