import { GripVertical } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Avatar, Icon, PriorityBars, StatusGlyph } from '../../../components';
import styles from './DragGhost.module.css';
import type { DragState, GhostRef } from './useTicketDrag';

export interface DragGhostProps {
  drag: DragState | null;
  ghostRef: GhostRef;
}

/** The lifted copy of the row that follows the pointer; portalled so no transform offsets it. */
export function DragGhost({ drag, ghostRef }: DragGhostProps) {
  if (!drag) return null;
  const { ticket, status, origin } = drag;
  return createPortal(
    <div
      ref={ghostRef}
      className={styles.ghost}
      style={{ left: origin.left, top: origin.top, width: origin.width }}
      aria-hidden="true"
    >
      <div className={styles.card}>
        <span className={styles.grip}>
          <Icon icon={GripVertical} />
        </span>
        <PriorityBars priority={ticket.priority} />
        <span className={styles.key}>{ticket.key}</span>
        <StatusGlyph category={status.category} color={status.color} animated={false} />
        <span className={styles.title}>{ticket.title || 'Untitled'}</span>
        <Avatar name={ticket.assignee} decorative />
      </div>
    </div>,
    document.body,
  );
}
