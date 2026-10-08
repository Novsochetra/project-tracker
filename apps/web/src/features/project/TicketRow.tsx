import type { Status, TicketListItem } from '@tracker/shared';
import clsx from 'clsx';
import { useState } from 'react';
import { useIsFlashing } from '../../app/flash';
import { SwipeActions } from '../../gestures';
import { useIsPhone } from '../../lib/media';
import { DROP_ROW_ATTRIBUTE } from './dnd/dropRow';
import type { DropEdge } from './dnd/dropTarget';
import { rowSwipeActions } from './rowSwipeActions';
import type { RowCallbacks } from './rowTypes';
import styles from './TicketRow.module.css';
import { TicketRowContent } from './TicketRowContent';

export interface TicketRowProps {
  ticket: TicketListItem;
  status: Status;
  next: Status | null;
  dragged: boolean;
  dropEdge: DropEdge | null;
  riseDelay: number | null;
  callbacks: RowCallbacks;
}

export function TicketRow(props: TicketRowProps) {
  const { ticket, status, next, dragged, dropEdge, riseDelay, callbacks } = props;
  const isPhone = useIsPhone();
  const flashing = useIsFlashing(ticket.key);
  // Fixed at mount, so a row rises once when "Show more" reveals it and never again.
  const [rise] = useState(riseDelay);
  const content = (
    <TicketRowContent ticket={ticket} status={status} dragged={dragged} callbacks={callbacks} />
  );
  return (
    <div
      className={clsx(styles.row, rise !== null && styles.rise)}
      style={rise === null ? undefined : { animationDelay: `${rise}ms` }}
      {...{ [DROP_ROW_ATTRIBUTE]: ticket.id }}
    >
      {isPhone ? (
        <SwipeActions {...rowSwipeActions(ticket, next, callbacks)}>{content}</SwipeActions>
      ) : (
        content
      )}
      {flashing && <span className={styles.flash} aria-hidden="true" />}
      {dropEdge && <span className={styles.dropLine} data-edge={dropEdge} aria-hidden="true" />}
    </div>
  );
}
