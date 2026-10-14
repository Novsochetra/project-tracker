import { projectDisplayName, sortLabels, type Label, type ProjectBoard } from '@tracker/shared';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { flushSync } from 'react-dom';
import { errorMessage, useBoard } from '../../api';
import type { SheetProps } from '../../app/sheets/types';
import { Button } from '../../components';
import { Sheet, SheetCancelButton } from '../../overlays';
import { BoardState } from '../statuses/BoardState';
import { OrderedList } from '../statuses/OrderedList';
import styles from '../statuses/StatusManagerSheet.module.css';
import { useInPlace } from '../statuses/useInPlace';
import { useRowFocus } from '../statuses/useRowFocus';
import { LabelDot } from './LabelDot';
import { LabelEditor } from './LabelEditor';
import { labelCounts, LABELS_HELP } from './labelForm';
import { useLabelOrder } from './useLabelOrder';

type LabelManagerSheetProps = SheetProps & { projectKey: string };

export function LabelManagerSheet({ open, onClose, projectKey }: LabelManagerSheetProps) {
  const board = useBoard(projectKey);
  const [unsavedEdit, setUnsavedEdit] = useState(false);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      label="Labels"
      title="Labels"
      subtitle={board.data && projectDisplayName(board.data.project)}
      left={<SheetCancelButton>Close</SheetCancelButton>}
      dirty={unsavedEdit}
    >
      <div className={styles.body}>
        <p className={styles.help}>{LABELS_HELP}</p>
        {board.data ? (
          <LabelManagerBody
            projectKey={projectKey}
            board={board.data}
            onDirtyChange={setUnsavedEdit}
          />
        ) : (
          <BoardState query={board} loading="Loading labels" />
        )}
      </div>
    </Sheet>
  );
}

type Editing = { kind: 'new' } | { kind: 'edit'; id: string } | null;

interface LabelManagerBodyProps {
  projectKey: string;
  board: ProjectBoard;
  onDirtyChange: (dirty: boolean) => void;
}

function LabelManagerBody({ projectKey, board, onDirtyChange }: LabelManagerBodyProps) {
  const labels = sortLabels(board.labels ?? []);
  const byId = new Map(labels.map((label) => [label.id, label]));
  const counts = labelCounts(board.tickets);
  const order = useLabelOrder(projectKey, labels);
  const [editing, setEditing] = useState<Editing>(null);
  const { addRef, rowRef, focusRow } = useRowFocus();
  const editingId = editing?.kind === 'edit' && byId.has(editing.id) ? editing.id : null;
  const adding = editing?.kind === 'new';
  const inPlace = useInPlace();
  const close = (focusId?: string) => {
    flushSync(() => inPlace(() => setEditing(null)));
    focusRow(focusId);
  };
  const open = (next: Editing) => inPlace(() => setEditing(next));
  const editor = (label: Label | null) => (
    <LabelEditor
      projectKey={projectKey}
      label={label}
      labels={labels}
      count={label ? (counts.get(label.id) ?? 0) : 0}
      onDone={close}
      onDeleted={() => close()}
      onDirtyChange={onDirtyChange}
    />
  );
  return (
    <>
      {(labels.length > 0 || adding) && (
        <OrderedList
          order={order}
          items={byId}
          counts={counts}
          editingId={editingId}
          dragDisabled={editing !== null}
          leading={(label) => <LabelDot color={label.color} large />}
          onEdit={(id) => open({ kind: 'edit', id })}
          renderEditor={editor}
          rowRef={rowRef}
        >
          {adding && editor(null)}
        </OrderedList>
      )}
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
          Add label
        </Button>
      )}
    </>
  );
}
