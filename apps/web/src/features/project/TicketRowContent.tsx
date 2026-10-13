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
import type { ReactNode } from 'react';
import { Avatar, Icon, PriorityBars, StatusGlyph, VerdictChip } from '../../components';
import { useStillWaiting } from '../requests/useStillWaiting';
import { WaitingMark } from '../requests/WaitingMark';
import { LabelChips, LabelDots } from '../labels/LabelChips';
import { useTicketLabels } from '../labels/projectLabels';
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
  children?: ReactNode;
}

export function DueLabel({ due, overdue, className, children }: DueLabelProps) {
  const label = due ? formatShortDay(due) : '';
  return (
    <span
      className={clsx(styles.due, className)}
      data-overdue={overdue || undefined}
      data-year={/\d{4}/.test(label) || undefined}
      data-no-date={due ? undefined : ''}
    >
      {due && <Icon icon={Calendar} size={14} />}
      {label}
      {children}
    </span>
  );
}

export function TicketRowContent({ ticket, status, dragged, callbacks }: TicketRowContentProps) {
  const isDone = isDoneCategory(status.category);
  const opening = useIsOpeningTicket(ticket);
  const waiting = useStillWaiting(ticket.waitingUntil);
  const labels = useTicketLabels(ticket);
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
        {waiting && <WaitingMark size="caption" className={styles.waiting} />}{' '}
        {isSentBack(ticket.lastReview, status.category) && (
          <VerdictChip verdict="changes_requested" compact className={styles.sentBack} />
        )}{' '}
        <LabelChips labels={labels} className={styles.labels} />{' '}
        {(ticket.due || labels.length > 0) && (
          <DueLabel due={ticket.due} overdue={isOverdue(ticket.due, isDone)}>
            <LabelDots labels={labels} className={styles.dots} />
          </DueLabel>
        )}{' '}
        <Avatar name={ticket.assignee} className={styles.assignee} />
      </button>
    </div>
  );
}
