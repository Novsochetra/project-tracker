import clsx from 'clsx';
import { motion } from 'motion/react';
import { useCallback, useRef, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { useKeyboardInset } from '../gestures/useKeyboardInset';
import { useTopPull } from '../gestures/useTopPull';
import { useAxisDrag } from '../gestures/useAxisDrag';
import { usePrefersReducedMotion } from '../lib/media';
import styles from './Sheet.module.css';
import type { SheetProps } from './sheetTypes';
import { useDialogPresence, useDialogValues } from './useDialogPresence';
import { useDismissDrag } from './useDismissDrag';
import { useOverlayBehavior } from './useOverlayBehavior';
import { useBottomPanelValues, useSlidePresence } from './useSlidePresence';

export interface SheetPanelProps extends SheetProps {
  isPhone: boolean;
  onExited: () => void;
}

function useKeyboardVars(enabled: boolean): CSSProperties | undefined {
  const { inset, viewportHeight } = useKeyboardInset();
  if (!enabled) return undefined;
  const vars: Record<string, string> = { '--sheet-keyboard': `${inset}px` };
  if (viewportHeight > 0) vars['--sheet-viewport'] = `${viewportHeight}px`;
  return vars;
}

interface SheetContentProps extends SheetPanelProps {
  handleRef: RefObject<HTMLDivElement | null>;
  bodyRef: RefObject<HTMLDivElement | null>;
}

function SheetContent(props: SheetContentProps): ReactNode {
  const { isPhone, left, title, subtitle, right, children, footer, handleRef, bodyRef } = props;
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
      <div ref={bodyRef} className={styles.body}>
        {children}
      </div>
      {footer !== undefined && <div className={styles.footer}>{footer}</div>}
    </>
  );
}

function useSheetMotion(props: SheetPanelProps, panelRef: RefObject<HTMLDivElement | null>) {
  const { open, isPhone, onExited, onClose } = props;
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
    onClose,
  });
  const panelStyle = isPhone
    ? { y: bottom.y, opacity: bottom.opacity }
    : { y: dialog.y, scale: dialog.scale, opacity: dialog.opacity };
  return { drag, panelStyle, scrim: isPhone ? bottom.scrim : dialog.scrim };
}

export function SheetPanel(props: SheetPanelProps) {
  const { open, onClose, label, size = 'form', isPhone, initialFocusRef, onSubmit } = props;
  const panelRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const keyboardVars = useKeyboardVars(isPhone);
  const { drag, panelStyle, scrim } = useSheetMotion(props, panelRef);
  useAxisDrag(handleRef, { ...drag, axis: 'y' });
  useTopPull(bodyRef, drag);
  const trapKeys = useOverlayBehavior({
    active: open,
    panelRef,
    onClose,
    initialFocusRef,
    focusInitial: !isPhone,
  });

  const content = <SheetContent {...props} handleRef={handleRef} bodyRef={bodyRef} />;
  return (
    <div
      className={clsx(styles.overlay, styles[size], isPhone ? styles.phone : styles.desktop)}
      style={keyboardVars}
      inert={!open}
      data-sheet=""
    >
      <motion.button
        type="button"
        tabIndex={-1}
        aria-label="Close"
        className={styles.scrim}
        style={{ opacity: scrim }}
        onClick={onClose}
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
          <form className={styles.form} onSubmit={onSubmit} noValidate>
            {content}
          </form>
        ) : (
          content
        )}
      </motion.div>
    </div>
  );
}
