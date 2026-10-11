import { isDoneCategory, isOverdue, isSentBack } from '@tracker/shared';
import clsx from 'clsx';
import { GripVertical } from 'lucide-react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Avatar, Icon, PriorityBars, StatusGlyph, VerdictChip } from '../../../components';
import { useStillWaiting } from '../../requests/useStillWaiting';
import { WaitingMark } from '../../requests/WaitingMark';
import { DueLabel } from '../TicketRowContent';
import styles from './DragGhost.module.css';
import type { DragState, GhostRef } from './useTicketDrag';

export interface DragGhostProps {
  drag: DragState | null;
  ghostRef: GhostRef;
  children?: ReactNode;
}

export function Lifted({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx(styles.lifted, className)}>{children}</div>;
}

function RowFace({ drag: { ticket, status } }: { drag: DragState }) {
  const isDone = isDoneCategory(status.category);
  const waiting = useStillWaiting(ticket.waitingUntil);
  return (
    <Lifted className={styles.row}>
      <span className={styles.grip}>
        <Icon icon={GripVertical} />
      </span>
      <PriorityBars priority={ticket.priority} className={styles.priority} />
      <span className={styles.key}>{ticket.key}</span>
      <StatusGlyph
        category={status.category}
        color={status.color}
        animated={false}
        className={styles.status}
      />
      <span className={styles.title}>{ticket.title || 'Untitled'}</span>
      {waiting && <WaitingMark size="caption" className={styles.waiting} />}
      {isSentBack(ticket.lastReview, status.category) && (
        <VerdictChip verdict="changes_requested" compact className={styles.sentBack} />
      )}
      {ticket.due && (
        <DueLabel due={ticket.due} overdue={isOverdue(ticket.due, isDone)} className={styles.due} />
      )}
      <Avatar name={ticket.assignee} decorative className={styles.assignee} />
    </Lifted>
  );
}

export function DragGhost({ drag, ghostRef, children }: DragGhostProps) {
  if (!drag) return null;
  const { origin } = drag;
  // Portalled so no transformed ancestor offsets its fixed position.
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
