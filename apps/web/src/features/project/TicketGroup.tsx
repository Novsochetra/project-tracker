import { collapseGroup, type Status } from '@tracker/shared';
import { groupRiseDelay, revealedRowDelay, type TicketGroupData } from './buildGroups';
import { DROP_GROUP_ATTRIBUTE } from './dnd/dropGroup';
import { dropEdgeFor } from './dnd/dropTarget';
import type { DragState } from './dnd/useTicketDrag';
import { toggleExpanded, useIsExpanded } from './expandedStore';
import { DropZone, GroupHeader, ShowMoreButton } from './GroupParts';
import type { RowCallbacks } from './rowTypes';
import styles from './TicketGroup.module.css';
import { TicketRow } from './TicketRow';
import type { RisePhase } from './useRisePhase';

export interface TicketGroupProps {
  projectKey: string;
  group: TicketGroupData;
  index: number;
  rise: RisePhase;
  searching: boolean;
  next: Status | null;
  drag: DragState | null;
  callbacks: RowCallbacks;
  onAdd: (statusId: string) => void;
}

export function TicketGroup(props: TicketGroupProps) {
  const { projectKey, group, index, rise, searching, next, drag, callbacks, onAdd } = props;
  const { status, tickets } = group;
  const expanded = useIsExpanded(projectKey, status.id);
  const collapsed = collapseGroup(tickets, { expanded, searching });
  const target = drag?.target?.statusId === status.id ? drag.target : null;
  const tint = target !== null && drag?.ticket.statusId !== status.id;
  return (
    <section
      aria-label={status.name}
      className={styles.group}
      {...{ [DROP_GROUP_ATTRIBUTE]: status.id }}
      data-rise={rise}
      style={{ animationDelay: `${groupRiseDelay(index)}ms` }}
    >
      <GroupHeader
        status={status}
        count={tickets.length}
        tint={tint}
        onAdd={() => onAdd(status.id)}
      />
      {drag && tickets.length === 0 && <DropZone name={status.name} targeted={target !== null} />}
      {collapsed.shown.map((ticket, row) => (
        <TicketRow
          key={ticket.id}
          ticket={ticket}
          status={status}
          next={next}
          dragged={drag?.ticket.id === ticket.id}
          dropEdge={dropEdgeFor(target, ticket.id)}
          riseDelay={revealedRowDelay(row, tickets.length)}
          callbacks={callbacks}
        />
      ))}
      {collapsed.hasToggle && (
        <ShowMoreButton
          expanded={expanded}
          hiddenCount={collapsed.hiddenCount}
          onToggle={() => toggleExpanded(projectKey, status.id)}
        />
      )}
    </section>
  );
}
