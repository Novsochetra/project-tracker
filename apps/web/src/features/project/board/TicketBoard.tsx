import { resolveFilter, type ProjectBoard } from '@tracker/shared';
import { Fragment, useMemo, useRef } from 'react';
import { useSheets } from '../../../app/sheets/context';
import { isPhoneNow, useIsPhone } from '../../../lib/media';
import { useScreen } from '../../../navigation';
import { buildColumns } from '../buildGroups';
import { DragGhost } from '../dnd/DragGhost';
import { useTicketDrag } from '../dnd/useTicketDrag';
import { isSearching, useListView } from '../listViewStore';
import type { CardCallbacks } from '../rowTypes';
import { useOpenTicket } from '../useRowCallbacks';
import { useTicketMove } from '../useTicketMove';
import styles from './Board.module.css';
import { desktopBoardEnvironment, phoneBoardEnvironment } from './boardEnvironment';
import { BoardCardGhost } from './BoardCard';
import { BoardColumn } from './BoardColumn';
import { BoardPager } from './BoardPager';
import { useBoardKeyboardMove } from './useBoardKeyboardMove';
import { useBoardPage, useFillHeight, useRevealFocusedCard } from './useBoardLayout';

export function TicketBoard({ board }: { board: ProjectBoard }) {
  const { project, statuses, tickets } = board;
  const view = useListView(project.key);
  const isPhone = useIsPhone();
  const { scrollRef } = useScreen();
  const sheets = useSheets();
  const frameRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const moveTicket = useTicketMove(project.key);
  const { drag, ghostRef, startDrag } = useTicketDrag({
    environment: (ticket, press) =>
      isPhoneNow()
        ? phoneBoardEnvironment(boardRef, ticket.id, press)
        : desktopBoardEnvironment(boardRef, ticket.id),
    onDrop: (ticket, target) => void moveTicket(ticket.id, target),
  });
  const handleKeyDown = useBoardKeyboardMove(project.key, moveTicket);
  const open = useOpenTicket(project.key);
  const callbacks = useMemo<CardCallbacks>(
    () => ({ open, startDrag, handleKeyDown }),
    [open, startDrag, handleKeyDown],
  );
  const columns = buildColumns({ ...view, statuses, tickets });
  const page = useBoardPage(boardRef, isPhone, columns.length);
  useFillHeight(frameRef, scrollRef);
  useRevealFocusedCard(boardRef);
  const addTicket = (statusId: string) =>
    sheets.open({ type: 'newTicket', projectKey: project.key, statusId });

  return (
    <>
      {isPhone && columns.length > 1 && <BoardPager columns={columns} page={page} />}
      <div ref={frameRef} className={styles.frame}>
        {/* Keeps the left edge free for swiping back to Projects instead of scrolling columns. */}
        {isPhone && <div className={styles.edgeGuard} aria-hidden="true" />}
        <div
          ref={boardRef}
          className={styles.board}
          data-board=""
          data-single={columns.length === 1 || undefined}
        >
          {/* A new tab remounts the columns, so they rise in again like the list's groups. */}
          <Fragment key={resolveFilter(statuses, view.filter)}>
            {columns.map((column, index) => (
              <BoardColumn
                key={column.status.id}
                column={column}
                index={index}
                searching={isSearching(view)}
                drag={drag}
                callbacks={callbacks}
                onAdd={addTicket}
              />
            ))}
          </Fragment>
        </div>
      </div>
      <DragGhost drag={drag} ghostRef={ghostRef}>
        {drag && <BoardCardGhost drag={drag} />}
      </DragGhost>
    </>
  );
}
