import { projectDisplayName, sortStatuses, type ProjectBoard, type Status } from '@tracker/shared';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { flushSync } from 'react-dom';
import { errorMessage, useBoard } from '../../api';
import type { SheetProps } from '../../app/sheets/types';
import { Button, StatusGlyph } from '../../components';
import { Sheet, SheetCancelButton } from '../../overlays';
import { BoardState } from './BoardState';
import { StatusEditor } from './StatusEditor';
import { OrderedList } from './OrderedList';
import styles from './StatusManagerSheet.module.css';
import { categoryHint, ticketCounts } from './statusForm';
import { useInPlace } from './useInPlace';
import { useRowFocus } from './useRowFocus';
import { useStatusOrder } from './useStatusOrder';

type StatusManagerSheetProps = SheetProps & { projectKey: string };

export const STATUSES_HELP =
  'Tickets are grouped by these statuses, in this order. A status’s type tells agents what it means.';

export function StatusManagerSheet({ open, onClose, projectKey }: StatusManagerSheetProps) {
  const board = useBoard(projectKey);
  const [unsavedEdit, setUnsavedEdit] = useState(false);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      label="Statuses"
      title="Statuses"
      subtitle={board.data && projectDisplayName(board.data.project)}
      left={<SheetCancelButton>Close</SheetCancelButton>}
      dirty={unsavedEdit}
    >
      <div className={styles.body}>
        <p className={styles.help}>{STATUSES_HELP}</p>
        {board.data ? (
          <StatusManagerBody
            projectKey={projectKey}
            board={board.data}
            onDirtyChange={setUnsavedEdit}
          />
        ) : (
          <BoardState query={board} loading="Loading statuses" />
        )}
      </div>
    </Sheet>
  );
}

type Editing = { kind: 'new' } | { kind: 'edit'; id: string } | null;

interface StatusManagerBodyProps {
  projectKey: string;
  board: ProjectBoard;
  onDirtyChange: (dirty: boolean) => void;
}

function StatusManagerBody({ projectKey, board, onDirtyChange }: StatusManagerBodyProps) {
  // Deleting doesn't patch the cache, so a deleted status hides here until the refetch lands.
  const [deleted, setDeleted] = useState<ReadonlySet<string>>(() => new Set());
  const statuses = sortStatuses(board.statuses).filter((status) => !deleted.has(status.id));
  const byId = new Map(statuses.map((status) => [status.id, status]));
  const counts = ticketCounts(board.tickets);
  const order = useStatusOrder(projectKey, statuses);
  const [editing, setEditing] = useState<Editing>(null);
  const { addRef, rowRef, focusRow } = useRowFocus();
  const editingId = editing?.kind === 'edit' && byId.has(editing.id) ? editing.id : null;
  const adding = editing?.kind === 'new';
  // Rows animate layout changes so reorders slide. An editor opening or closing isn't one, so
  // the rows around it move at once instead of sliding over it.
  const inPlace = useInPlace();

  // The editor replaces the row (or the Add button), so focus goes back once it is gone.
  const close = (update: () => void, focusId?: string) => {
    flushSync(() => inPlace(update));
    focusRow(focusId);
  };
  const open = (next: Editing) => inPlace(() => setEditing(next));
  const finish = (focusId?: string) => close(() => setEditing(null), focusId);
  const removed = (id: string) =>
    close(() => {
      setEditing(null);
      setDeleted((current) => new Set(current).add(id));
    });
  const editor = (status: Status | null) => (
    <StatusEditor
      projectKey={projectKey}
      status={status}
      statuses={statuses}
      count={status ? (counts.get(status.id) ?? 0) : 0}
      onDone={finish}
      onDeleted={removed}
      onDirtyChange={onDirtyChange}
    />
  );
  return (
    <>
      <OrderedList
        order={order}
        items={byId}
        counts={counts}
        editingId={editingId}
        dragDisabled={editing !== null}
        leading={(status) => (
          <StatusGlyph category={status.category} color={status.color} animated={false} />
        )}
        hint={categoryHint}
        onEdit={(id) => open({ kind: 'edit', id })}
        renderEditor={editor}
        rowRef={rowRef}
      >
        {adding && editor(null)}
      </OrderedList>
      {order.error && (
        <p role="alert" className={styles.error}>
          {errorMessage(order.error)}
        </p>
      )}
      {!adding && (
        <Button
          ref={addRef}
          icon={Plus}
          className={styles.add}
          onClick={() => open({ kind: 'new' })}
        >
          Add status
        </Button>
      )}
    </>
  );
}
