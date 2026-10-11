import clsx from 'clsx';
import { motion } from 'motion/react';
import { useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTapShield } from '../lib/clickShield';
import styles from './ActionSheet.module.css';
import { actionSheetContent } from './actionSheetContent';
import { useActionSheetMotion } from './useActionSheetMotion';
import { useCloseHold } from './useCloseHold';
import { useOverlayBehavior } from './useOverlayBehavior';
import { usePresence } from './usePresence';
import { useRowPeek } from './useRowPeek';

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
  holdOnClose?: boolean;
}

function ActionSheetPanel(props: ActionSheetProps & { onExited: () => void }) {
  const { open, onClose, label, caption, actions, cancelLabel = 'Cancel', onExited } = props;
  const panelRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const content = actionSheetContent(caption, actions);
  useRowPeek(cardRef, content);
  const values = useActionSheetMotion({ open, onClose, onExited, panelRef, cardRef });
  const trapKeys = useOverlayBehavior({ active: open, panelRef, onClose, focusInitial: false });
  // A tap opens the sheet, which slides up under the finger, or turns it into its next step, whose
  // row can take the tapped row's place (a delete confirm), so a double tap's second tap would
  // press the row that just arrived. Cancel stays where it was and keeps taking taps.
  const shield = useTapShield(open && content);
  const closeHold = useCloseHold(open, props.holdOnClose);

  return (
    <div className={styles.overlay} inert={!open} data-action-sheet="" {...closeHold}>
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
        style={{ y: values.y, opacity: values.opacity }}
        onKeyDown={trapKeys}
      >
        <div ref={cardRef} role="presentation" className={styles.card} {...shield}>
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
