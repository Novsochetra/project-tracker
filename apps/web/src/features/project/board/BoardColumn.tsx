import { groupRiseDelay, type TicketGroupData } from '../buildGroups';
import { dropEdgeFor } from '../dnd/dropTarget';
import type { DragState } from '../dnd/useTicketDrag';
import { DropZone, GroupHeader } from '../GroupParts';
import type { CardCallbacks } from '../rowTypes';
import styles from './Board.module.css';
import { BoardCard } from './BoardCard';

export interface BoardColumnProps {
  column: TicketGroupData;
  index: number;
  searching: boolean;
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
  const { column, index, searching, drag, callbacks, onAdd } = props;
  const { status, tickets } = column;
  const target = drag?.target?.statusId === status.id ? drag.target : null;
  const tint = target !== null && drag?.ticket.statusId !== status.id;
  return (
    <section
      aria-label={status.name}
      className={styles.column}
      data-drop-group={status.id}
      data-tint={tint || undefined}
      style={{ animationDelay: `${groupRiseDelay(index)}ms` }}
    >
      <GroupHeader
        status={status}
        count={tickets.length}
        tint={false}
        onAdd={() => onAdd(status.id)}
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
