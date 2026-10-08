import type { Status, TicketListItem } from '@tracker/shared';
import clsx from 'clsx';
import { GripVertical } from 'lucide-react';
import { useIsFlashing } from '../../../app/flash';
import { Icon } from '../../../components';
import { Lifted } from '../dnd/DragGhost';
import { DROP_ROW_ATTRIBUTE } from '../dnd/dropRow';
import type { DropEdge } from '../dnd/dropTarget';
import type { DragState } from '../dnd/useTicketDrag';
import { DragHandle } from '../DragHandle';
import type { CardCallbacks } from '../rowTypes';
import { useIsOpeningTicket } from '../useRowCallbacks';
import styles from './BoardCard.module.css';
import { BoardCardFace } from './BoardCardFace';

export interface BoardCardProps {
  ticket: TicketListItem;
  status: Status;
  dragged: boolean;
  dropEdge: DropEdge | null;
  callbacks: CardCallbacks;
}

export function BoardCard({ ticket, status, dragged, dropEdge, callbacks }: BoardCardProps) {
  const flashing = useIsFlashing(ticket.key);
  const opening = useIsOpeningTicket(ticket);
  return (
    <div className={styles.card} {...{ [DROP_ROW_ATTRIBUTE]: ticket.id }}>
      <DragHandle
        ticket={ticket}
        className={styles.handle}
        onPointerDown={(event) => callbacks.startDrag(event, ticket, status, true)}
        onKeyDown={(event) => callbacks.handleKeyDown(event, ticket)}
      />
      <button
        type="button"
        className={clsx('ring-inside', styles.face, styles.main)}
        data-dragged={dragged || undefined}
        data-opening={opening || undefined}
        onClick={() => callbacks.open(ticket)}
        onPointerDown={(event) => callbacks.startDrag(event, ticket, status, false)}
      >
        <BoardCardFace ticket={ticket} status={status} />
      </button>
      {flashing && <span className={styles.flash} aria-hidden="true" />}
      {dropEdge && <span className={styles.dropLine} data-edge={dropEdge} aria-hidden="true" />}
    </div>
  );
}

export function BoardCardGhost({ drag }: { drag: DragState }) {
  return (
    <Lifted className={clsx(styles.face, styles.ghost)}>
      <span className={styles.grip}>
        <Icon icon={GripVertical} />
      </span>
      <BoardCardFace ticket={drag.ticket} status={drag.status} decorative />
    </Lifted>
  );
}
