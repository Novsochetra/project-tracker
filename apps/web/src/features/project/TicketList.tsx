import { projectDisplayName, resolveFilter, type ProjectBoard } from '@tracker/shared';
import { useRef } from 'react';
import { useSheets } from '../../app/sheets/context';
import { useScreen } from '../../navigation';
import { buildGroups, nextStatus } from './buildGroups';
import { DragGhost } from './dnd/DragGhost';
import { listEnvironment } from './dnd/listEnvironment';
import { useKeyboardMove } from './dnd/useKeyboardMove';
import { useTicketDrag } from './dnd/useTicketDrag';
import { NoMatches, NoTickets } from './ListEmptyStates';
import { isSearching, pickedLabel, pickedStatus, useListView } from './listViewStore';
import styles from './ProjectScreen.module.css';
import { RowActionSheets } from './RowActionSheets';
import { TicketGroup } from './TicketGroup';
import { useRowCallbacks } from './useRowCallbacks';
import { useRowSheet } from './useRowSheet';
import { useRisePhase } from './useRisePhase';
import { useTicketMove } from './useTicketMove';

export function TicketList({ board }: { board: ProjectBoard }) {
  const { project, statuses, tickets } = board;
  const view = useListView(project.key);
  const { scrollRef } = useScreen();
  const sheets = useSheets();
  const containerRef = useRef<HTMLDivElement>(null);
  const moveTicket = useTicketMove(project.key);
  const { drag, ghostRef, startDrag } = useTicketDrag({
    environment: (ticket) =>
      listEnvironment({ groups: containerRef, scroller: scrollRef }, ticket.id),
    onDrop: (ticket, target) => void moveTicket(ticket.id, target),
  });
  const handleKeyDown = useKeyboardMove(project.key, view.filter, moveTicket);
  const rowSheet = useRowSheet();
  const callbacks = useRowCallbacks({
    projectKey: project.key,
    startDrag,
    handleKeyDown,
    showSheet: rowSheet.show,
  });
  const addTicket = (statusId?: string) =>
    sheets.open({ type: 'newTicket', projectKey: project.key, statusId });
  const label = pickedLabel(view, board.labels)?.id;
  const groups = buildGroups({ ...view, label, statuses, tickets, dragging: drag !== null });
  const rise = useRisePhase(resolveFilter(statuses, view.filter));

  const renderGroups = () => (
    <div ref={containerRef} className={styles.groups}>
      {groups.map((group, index) => (
        <TicketGroup
          key={group.status.id}
          projectKey={project.key}
          group={group}
          index={index}
          rise={rise}
          searching={isSearching(view)}
          next={nextStatus(statuses, group.status.id)}
          drag={drag}
          callbacks={callbacks}
          onAdd={addTicket}
        />
      ))}
    </div>
  );
  const renderBody = () => {
    if (tickets.length === 0) {
      return <NoTickets projectName={projectDisplayName(project)} />;
    }
    if (groups.length > 0) return renderGroups();
    return (
      <NoMatches status={isSearching(view) ? undefined : pickedStatus(view, statuses)?.name} />
    );
  };

  return (
    <>
      {renderBody()}
      <DragGhost drag={drag} ghostRef={ghostRef} />
      <RowActionSheets sheet={rowSheet.sheet} statuses={statuses} onClose={rowSheet.close} />
    </>
  );
}
