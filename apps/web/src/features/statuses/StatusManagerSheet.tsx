import { sortStatuses, type ProjectBoard, type Status } from '@tracker/shared';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { flushSync } from 'react-dom';
import { errorMessage, useBoard, type TrackerQuery } from '../../api';
import type { SheetProps } from '../../app/sheets/types';
import { Button, Spinner } from '../../components';
import { Sheet, SheetTextButton } from '../../overlays';
import { StatusEditor } from './StatusEditor';
import { StatusList } from './StatusList';
import styles from './StatusManagerSheet.module.css';
import { ticketCounts } from './statusForm';
import { useRowFocus } from './useRowFocus';
import { useStatusOrder } from './useStatusOrder';

type StatusManagerSheetProps = SheetProps & { projectKey: string };

export const STATUSES_HELP =
  'Tickets are grouped by these statuses, in this order. A status’s type tells agents what it means.';

export function StatusManagerSheet({ open, onClose, projectKey }: StatusManagerSheetProps) {
  const board = useBoard(projectKey);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      label="Statuses"
      title="Statuses"
      subtitle={board.data?.project.name}
      left={<SheetTextButton onClick={onClose}>Close</SheetTextButton>}
    >
      <div className={styles.body}>
        <p className={styles.help}>{STATUSES_HELP}</p>
        {board.data ? (
          <StatusManagerBody projectKey={projectKey} board={board.data} />
        ) : (
          <BoardState query={board} />
        )}
      </div>
    </Sheet>
  );
}

type Editing = { kind: 'new' } | { kind: 'edit'; id: string } | null;

function StatusManagerBody({ projectKey, board }: { projectKey: string; board: ProjectBoard }) {
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

  // The editor replaces the row (or the Add button), so focus goes back once it is gone.
  const close = (update: () => void, focusId?: string) => {
    flushSync(update);
    focusRow(focusId);
  };
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
    />
  );
  return (
    <>
      <StatusList
        order={order}
        statuses={byId}
        counts={counts}
        editingId={editingId}
        dragDisabled={editing !== null}
        onEdit={(id) => setEditing({ kind: 'edit', id })}
        renderEditor={editor}
        rowRef={rowRef}
      >
        {adding && editor(null)}
      </StatusList>
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
          onClick={() => setEditing({ kind: 'new' })}
        >
          Add status
        </Button>
      )}
    </>
  );
}

function BoardState({ query }: { query: TrackerQuery<ProjectBoard> }) {
  if (!query.isError) {
    return (
      <div className={styles.loading}>
        <Spinner label="Loading statuses" />
      </div>
    );
  }
  return (
    <>
      <p role="alert" className={styles.error}>
        {errorMessage(query.error)}
      </p>
      <Button size="sm" className={styles.retry} onClick={() => void query.refetch()}>
        Try again
      </Button>
    </>
  );
}
