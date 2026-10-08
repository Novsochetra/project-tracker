import {
  formatShortDay,
  isDoneCategory,
  isOverdue,
  isSentBack,
  type Status,
  type TicketListItem,
} from '@tracker/shared';
import clsx from 'clsx';
import { Calendar } from 'lucide-react';
import { Avatar, Icon, PriorityBars, StatusGlyph, VerdictChip } from '../../components';
import { DragHandle } from './DragHandle';
import type { RowCallbacks } from './rowTypes';
import styles from './TicketRow.module.css';
import { useIsOpeningTicket } from './useRowCallbacks';

export interface TicketRowContentProps {
  ticket: TicketListItem;
  status: Status;
  dragged: boolean;
  callbacks: RowCallbacks;
}

export interface DueLabelProps {
  due: string;
  overdue: boolean;
  className?: string | undefined;
}

export function DueLabel({ due, overdue, className }: DueLabelProps) {
  const label = formatShortDay(due);
  return (
    <span
      className={clsx(styles.due, className)}
      data-overdue={overdue || undefined}
      data-year={/\d{4}/.test(label) || undefined}
    >
      <Icon icon={Calendar} size={14} />
      {label}
    </span>
  );
}

export function TicketRowContent({ ticket, status, dragged, callbacks }: TicketRowContentProps) {
  const isDone = isDoneCategory(status.category);
  const opening = useIsOpeningTicket(ticket);
  return (
    <div className={styles.inner}>
      <DragHandle
        ticket={ticket}
        onPointerDown={(event) => callbacks.startDrag(event, ticket, status, true)}
        onKeyDown={(event) => callbacks.handleKeyDown(event, ticket)}
      />
      <button
        type="button"
        className={clsx('ring-inside', styles.main)}
        data-dragged={dragged || undefined}
        data-opening={opening || undefined}
        onClick={() => callbacks.open(ticket)}
        onPointerDown={(event) => callbacks.startDrag(event, ticket, status, false)}
      >
        <PriorityBars priority={ticket.priority} className={styles.priority} />
        {/* The spaces keep the parts apart in the accessible name, which starts with the key. */}
        <span className={styles.key}>{ticket.key}</span>{' '}
        <StatusGlyph category={status.category} color={status.color} className={styles.status} />
        <span className={styles.title} data-done={isDone || undefined}>
          {ticket.title || 'Untitled'}
        </span>{' '}
        {isSentBack(ticket.lastReview, status.category) && (
          <VerdictChip verdict="changes_requested" compact className={styles.sentBack} />
        )}{' '}
        {ticket.due && <DueLabel due={ticket.due} overdue={isOverdue(ticket.due, isDone)} />}{' '}
        <Avatar name={ticket.assignee} className={styles.assignee} />
      </button>
    </div>
  );
}
