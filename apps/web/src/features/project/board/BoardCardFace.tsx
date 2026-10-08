import { isDoneCategory, isOverdue, type Status, type TicketListItem } from '@tracker/shared';
import { Avatar, PriorityBars } from '../../../components';
import { DueLabel } from '../TicketRowContent';
import styles from './BoardCard.module.css';

export interface BoardCardFaceProps {
  ticket: TicketListItem;
  status: Status;
  /** The ghost's copy hides its avatar name from assistive tech. */
  decorative?: boolean;
}

/** What a card shows: key and priority, the title, the due date and the assignee. */
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
      {ticket.due && (
        <DueLabel due={ticket.due} overdue={isOverdue(ticket.due, isDone)} className={styles.due} />
      )}{' '}
      <Avatar name={ticket.assignee} decorative={decorative} className={styles.avatar} />
    </>
  );
}
