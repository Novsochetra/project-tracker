import { collapseGroup, type Status } from '@tracker/shared';
import { useRef } from 'react';
import type { DoneBatch } from '../ready/doneBatch';
import { MoveAllToDone } from '../ready/MoveAllToDone';
import { groupRiseDelay, revealedRowDelay, type TicketGroupData } from './buildGroups';
import { DROP_GROUP_ATTRIBUTE } from './dnd/dropGroup';
import { GROUP_END_ATTRIBUTE } from './dnd/listRows';
import type { DragState } from './dnd/useTicketDrag';
import { toggleExpanded, useIsExpanded } from './expandedStore';
import { followMovedTickets } from './movedFocus';
import { DropZone, GroupHeader, ShowMoreButton } from './GroupParts';
import type { RowCallbacks } from './rowTypes';
import styles from './TicketGroup.module.css';
import { TicketRow } from './TicketRow';
import { useGroupToggle } from './useGroupToggle';
import type { RisePhase } from './useRisePhase';

export interface TicketGroupProps {
  projectKey: string;
  group: TicketGroupData;
  index: number;
  rise: RisePhase;
  searching: boolean;
  next: Status | null;
  doneBatch: DoneBatch | null;
  drag: DragState | null;
  callbacks: RowCallbacks;
  onAdd: (statusId: string) => void;
}

export function TicketGroup(props: TicketGroupProps) {
  const { projectKey, group, index, rise, searching, next, doneBatch, drag, callbacks, onAdd } =
    props;
  const { status, tickets } = group;
  const ref = useRef<HTMLElement>(null);
  const footerRef = useRef<HTMLButtonElement>(null);
  const expanded = useIsExpanded(projectKey, status.id);
  const toggle = useGroupToggle({ top: ref, footer: footerRef }, expanded, () =>
    toggleExpanded(projectKey, status.id),
  );
  const collapsed = collapseGroup(tickets, { expanded, searching });
  const unfolded = expanded && collapsed.hasToggle;
  const target = drag?.target?.statusId === status.id ? drag.target : null;
  const tint = target !== null && drag?.ticket.statusId !== status.id;
  const movedAll = (moving: Promise<unknown>) =>
    followMovedTickets(ref.current, tickets[0]?.id, moving);

  return (
    <section
      ref={ref}
      aria-label={status.name}
      className={styles.group}
      {...{ [DROP_GROUP_ATTRIBUTE]: status.id }}
      data-rise={rise}
      data-expanded={unfolded || undefined}
      style={{ animationDelay: `${groupRiseDelay(index)}ms` }}
    >
      <GroupHeader
        status={status}
        count={tickets.length}
        tint={tint}
        onAdd={() => onAdd(status.id)}
        onCollapse={unfolded ? toggle : undefined}
        action={
          <MoveAllToDone
            batch={doneBatch}
            place="header"
            className={styles.action}
            onMove={movedAll}
          />
        }
      />
      {drag && tickets.length === 0 && <DropZone name={status.name} targeted={target !== null} />}
      {collapsed.shown.map((ticket, row) => (
        <TicketRow
          key={ticket.id}
          ticket={ticket}
          status={status}
          next={next}
          dragged={drag?.ticket.id === ticket.id}
          riseDelay={revealedRowDelay(row, tickets.length)}
          callbacks={callbacks}
        />
      ))}
      <div {...{ [GROUP_END_ATTRIBUTE]: status.id }} className={styles.end}>
        {collapsed.hasToggle && (
          <ShowMoreButton
            ref={footerRef}
            expanded={expanded}
            hiddenCount={collapsed.hiddenCount}
            onToggle={toggle}
          />
        )}
        <MoveAllToDone batch={doneBatch} place="footer" onMove={movedAll} />
      </div>
    </section>
  );
}
