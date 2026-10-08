import {
  isDoneCategory,
  isOverdue,
  isSentBack,
  type Status,
  type TicketListItem,
} from '@tracker/shared';
import { Avatar, PriorityBars, VerdictChip } from '../../../components';
import { DueLabel } from '../TicketRowContent';
import styles from './BoardCard.module.css';

export interface BoardCardFaceProps {
  ticket: TicketListItem;
  status: Status;
  /** The ghost's copy hides its avatar name from assistive tech. */
  decorative?: boolean;
}

/** What a card shows: key and priority, the title, a sent-back chip, due date and assignee. */
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
  if (!sentBack && !ticket.due) return null;
  const overdue = isOverdue(ticket.due, isDoneCategory(status.category));
  return (
    <span className={styles.meta}>
      {sentBack && <VerdictChip verdict="changes_requested" />}{' '}
      {ticket.due && <DueLabel due={ticket.due} overdue={overdue} className={styles.due} />}
    </span>
  );
}
