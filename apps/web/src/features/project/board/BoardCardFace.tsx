import {
  isDoneCategory,
  isOverdue,
  isSentBack,
  type Status,
  type TicketListItem,
} from '@tracker/shared';
import { Avatar, PriorityBars, VerdictChip } from '../../../components';
import { useStillWaiting } from '../../requests/useStillWaiting';
import { WaitingMark } from '../../requests/WaitingMark';
import { LabelChips } from '../../labels/LabelChips';
import { useTicketLabels } from '../../labels/projectLabels';
import { DueLabel } from '../TicketRowContent';
import styles from './BoardCard.module.css';

export interface BoardCardFaceProps {
  ticket: TicketListItem;
  status: Status;
  decorative?: boolean;
}

export function BoardCardFace({ ticket, status, decorative = false }: BoardCardFaceProps) {
  const isDone = isDoneCategory(status.category);
  return (
    <>
      <PriorityBars priority={ticket.priority} className={styles.bars} />
      {/* The spaces keep the parts apart in the accessible name, which starts with the key. */}
      <span className={styles.key}>{ticket.key}</span>{' '}
      <span className={styles.title} data-done={isDone || undefined}>
        {ticket.title || 'Untitled'}
      </span>{' '}
      <CardMeta ticket={ticket} status={status} />{' '}
      <Avatar name={ticket.assignee} decorative={decorative} className={styles.avatar} />
    </>
  );
}

function CardMeta({ ticket, status }: Omit<BoardCardFaceProps, 'decorative'>) {
  const sentBack = isSentBack(ticket.lastReview, status.category);
  const waiting = useStillWaiting(ticket.waitingUntil);
  const labels = useTicketLabels(ticket);
  if (!waiting && !sentBack && !ticket.due && labels.length === 0) return null;
  const overdue = isOverdue(ticket.due, isDoneCategory(status.category));
  return (
    <span className={styles.meta}>
      {waiting && <WaitingMark size="caption" />}{' '}
      {sentBack && <VerdictChip verdict="changes_requested" />}{' '}
      {ticket.due && <DueLabel due={ticket.due} overdue={overdue} className={styles.due} />}{' '}
      <LabelChips labels={labels} />
    </span>
  );
}
