import {
  formatShortDay,
  isDoneCategory,
  isOverdue,
  type Status,
  type TicketListItem,
} from '@tracker/shared';
import clsx from 'clsx';
import { Calendar } from 'lucide-react';
import { Avatar, Icon, PriorityBars, StatusGlyph } from '../../components';
import { DragHandle } from './DragHandle';
import type { RowCallbacks } from './rowTypes';
import styles from './TicketRow.module.css';

export interface TicketRowContentProps {
  ticket: TicketListItem;
  status: Status;
  dragged: boolean;
  callbacks: RowCallbacks;
}

function DueLabel({ due, overdue }: { due: string; overdue: boolean }) {
  return (
    <span className={styles.due} data-overdue={overdue || undefined}>
      <Icon icon={Calendar} size={14} />
      {formatShortDay(due)}
    </span>
  );
}

export function TicketRowContent({ ticket, status, dragged, callbacks }: TicketRowContentProps) {
  const isDone = isDoneCategory(status.category);
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
        onClick={() => callbacks.open(ticket)}
        onPointerDown={(event) => callbacks.startDrag(event, ticket, status, false)}
      >
        <PriorityBars priority={ticket.priority} />
        {/* The spaces keep the parts apart in the accessible name, which starts with the key. */}
        <span className={styles.key}>{ticket.key}</span>{' '}
        <StatusGlyph category={status.category} color={status.color} />
        <span className={styles.title} data-done={isDone || undefined}>
          {ticket.title || 'Untitled'}
        </span>{' '}
        {ticket.due && <DueLabel due={ticket.due} overdue={isOverdue(ticket.due, isDone)} />}{' '}
        <Avatar name={ticket.assignee} />
      </button>
    </div>
  );
}
