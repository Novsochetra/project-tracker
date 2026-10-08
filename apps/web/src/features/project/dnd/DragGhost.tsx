import clsx from 'clsx';
import { GripVertical } from 'lucide-react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Avatar, Icon, PriorityBars, StatusGlyph } from '../../../components';
import styles from './DragGhost.module.css';
import type { DragState, GhostRef } from './useTicketDrag';

export interface DragGhostProps {
  drag: DragState | null;
  ghostRef: GhostRef;
  /** The lifted face; the list's row when left out. */
  children?: ReactNode;
}

/** The white card that lifts off the page with the Lifted shadow. */
export function Lifted({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx(styles.lifted, className)}>{children}</div>;
}

function RowFace({ drag: { ticket, status } }: { drag: DragState }) {
  return (
    <Lifted className={styles.row}>
      <span className={styles.grip}>
        <Icon icon={GripVertical} />
      </span>
      <PriorityBars priority={ticket.priority} />
      <span className={styles.key}>{ticket.key}</span>
      <StatusGlyph category={status.category} color={status.color} animated={false} />
      <span className={styles.title}>{ticket.title || 'Untitled'}</span>
      <Avatar name={ticket.assignee} decorative />
    </Lifted>
  );
}

/** The lifted copy that follows the pointer; portalled so no transform offsets it. */
export function DragGhost({ drag, ghostRef, children }: DragGhostProps) {
  if (!drag) return null;
  const { origin } = drag;
  return createPortal(
    <div
      ref={ghostRef}
      className={styles.ghost}
      style={{ left: origin.left, top: origin.top, width: origin.width }}
      aria-hidden="true"
    >
      {children ?? <RowFace drag={drag} />}
    </div>,
    document.body,
  );
}
