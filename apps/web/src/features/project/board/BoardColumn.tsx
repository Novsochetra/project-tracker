import { useRef } from 'react';
import type { DoneBatch } from '../../ready/doneBatch';
import { MoveAllToDone } from '../../ready/MoveAllToDone';
import { groupRiseDelay, type TicketGroupData } from '../buildGroups';
import { DROP_GROUP_ATTRIBUTE } from '../dnd/dropGroup';
import { dropEdgeFor } from '../dnd/dropTarget';
import type { DragState } from '../dnd/useTicketDrag';
import { DropZone, GroupHeader } from '../GroupParts';
import { followMovedCards } from '../movedFocus';
import type { CardCallbacks } from '../rowTypes';
// The header's own place for an action, before the +.
import groupStyles from '../TicketGroup.module.css';
import styles from './Board.module.css';
import { BoardCard } from './BoardCard';

export interface BoardColumnProps {
  column: TicketGroupData;
  index: number;
  searching: boolean;
  doneBatch: DoneBatch | null;
  drag: DragState | null;
  callbacks: CardCallbacks;
  onAdd: (statusId: string) => void;
}

interface EmptyColumnProps {
  name: string;
  searching: boolean;
  dragging: boolean;
  targeted: boolean;
}

function EmptyColumn({ name, searching, dragging, targeted }: EmptyColumnProps) {
  if (dragging) return <DropZone name={name} targeted={targeted} />;

  return <p className={styles.empty}>{searching ? 'No matches' : 'No tickets'}</p>;
}

export function BoardColumn(props: BoardColumnProps) {
  const { column, index, searching, doneBatch, drag, callbacks, onAdd } = props;
  const { status, tickets } = column;
  const addRef = useRef<HTMLButtonElement>(null);
  const target = drag?.target?.statusId === status.id ? drag.target : null;
  const tint = target !== null && drag?.ticket.statusId !== status.id;
  const movedAll = (moving: Promise<unknown>) =>
    followMovedCards(addRef.current, tickets[0]?.id, moving);

  return (
    <section
      aria-label={status.name}
      className={styles.column}
      {...{ [DROP_GROUP_ATTRIBUTE]: status.id }}
      data-tint={tint || undefined}
      style={{ animationDelay: `${groupRiseDelay(index)}ms` }}
    >
      <GroupHeader
        status={status}
        count={tickets.length}
        tint={false}
        onAdd={() => onAdd(status.id)}
        addRef={addRef}
        action={
          <MoveAllToDone
            batch={doneBatch}
            place="column"
            className={groupStyles.action}
            onMove={movedAll}
          />
        }
        className={styles.header}
      />
      <div className={styles.body} data-column-body="">
        {tickets.length === 0 && (
          <EmptyColumn
            name={status.name}
            searching={searching}
            dragging={drag !== null}
            targeted={target !== null}
          />
        )}
        {tickets.map((ticket) => (
          <BoardCard
            key={ticket.id}
            ticket={ticket}
            status={status}
            dragged={drag?.ticket.id === ticket.id}
            dropEdge={dropEdgeFor(target, ticket.id)}
            callbacks={callbacks}
          />
        ))}
      </div>
    </section>
  );
}
