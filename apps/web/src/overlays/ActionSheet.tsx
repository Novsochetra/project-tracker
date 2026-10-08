import clsx from 'clsx';
import { motion } from 'motion/react';
import { useCallback, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useAxisDrag } from '../gestures/useAxisDrag';
import { useClickShield } from '../lib/clickShield';
import { usePrefersReducedMotion } from '../lib/media';
import styles from './ActionSheet.module.css';
import { useDismissDrag } from './useDismissDrag';
import { useOverlayBehavior } from './useOverlayBehavior';
import { usePresence } from './usePresence';
import { useBottomPanelValues, useSlidePresence } from './useSlidePresence';

export interface ActionSheetAction {
  label: string;
  tone?: 'danger';
  bold?: boolean;
  onSelect: () => void;
}

export interface ActionSheetProps {
  open: boolean;
  onClose: () => void;
  label: string;
  caption?: ReactNode;
  actions: ActionSheetAction[];
  cancelLabel?: string;
}

const rowsOf = (actions: ActionSheetAction[]): string =>
  actions.map((action) => [action.label, action.tone, action.bold].join(' ')).join('\n');

function ActionSheetPanel(props: ActionSheetProps & { onExited: () => void }) {
  const { open, onClose, label, caption, actions, cancelLabel = 'Cancel', onExited } = props;
  const reducedMotion = usePrefersReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const releaseVelocityRef = useRef(0);
  const values = useBottomPanelValues();
  const { y } = values;
  // Measured from the resting position, so an exit that starts mid-drag still leaves the screen.
  const measureTravel = useCallback(() => {
    const panel = panelRef.current;
    return panel ? window.innerHeight - (panel.getBoundingClientRect().top - y.get()) : null;
  }, [y]);
  useSlidePresence({
    enabled: true,
    open,
    reducedMotion,
    values,
    measureTravel,
    releaseVelocityRef,
    onExited,
  });
  const drag = useDismissDrag({
    enabled: open,
    open,
    y,
    travel: values.travel,
    measureTravel,
    releaseVelocityRef,
    onClose,
  });
  useAxisDrag(panelRef, { ...drag, axis: 'y' });
  const trapKeys = useOverlayBehavior({ active: open, panelRef, onClose, focusInitial: false });
  // A tap opens the sheet, which slides up under the finger, or turns it into its next step, whose
  // row can take the tapped row's place (a delete confirm), so a double tap's second tap would
  // press the row that just arrived. Cancel stays where it was and keeps taking taps.
  const shield = useClickShield(open && rowsOf(actions));

  return (
    <div className={styles.overlay} inert={!open} data-action-sheet="">
      <motion.button
        type="button"
        tabIndex={-1}
        aria-label="Close"
        className={styles.scrim}
        style={{ opacity: values.scrim }}
        onClick={onClose}
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={styles.sheet}
        style={{ y, opacity: values.opacity }}
        onKeyDown={trapKeys}
      >
        <div
          role="presentation"
          className={styles.card}
          onMouseDownCapture={shield}
          onClickCapture={shield}
        >
          {caption !== undefined && (
            <div key={typeof caption === 'string' ? caption : undefined} className={styles.caption}>
              {caption}
            </div>
          )}
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={clsx(
                styles.row,
                'ring-inside',
                action.tone === 'danger' && styles.danger,
                action.bold && styles.bold,
              )}
              onClick={action.onSelect}
            >
              {action.label}
            </button>
          ))}
        </div>
        <button type="button" className={clsx(styles.cancel, 'ring-inside')} onClick={onClose}>
          {cancelLabel}
        </button>
      </motion.div>
    </div>
  );
}

// Selecting an action leaves the sheet open, so the owner can swap the actions or close it.
export function ActionSheet(props: ActionSheetProps) {
  const { mounted, onExited } = usePresence(props.open);
  if (!mounted) return null;
  return createPortal(<ActionSheetPanel {...props} onExited={onExited} />, document.body);
}
