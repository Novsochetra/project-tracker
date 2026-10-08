import type { Status } from '@tracker/shared';
import { Reorder } from 'motion/react';
import { useId, type ReactNode } from 'react';
import { announce } from '../../app/announce';
import { GroupedCard } from '../../components';
import { usePrefersReducedMotion } from '../../lib/media';
import styles from './StatusManagerSheet.module.css';
import { moveInOrder } from './statusForm';
import { StatusListRow } from './StatusListRow';
import type { StatusOrder } from './useStatusOrder';

export interface StatusListProps {
  order: StatusOrder;
  statuses: ReadonlyMap<string, Status>;
  counts: ReadonlyMap<string, number>;
  editingId: string | null;
  dragDisabled: boolean;
  onEdit: (id: string) => void;
  renderEditor: (status: Status) => ReactNode;
  rowRef: (id: string) => (element: HTMLButtonElement | null) => void;
  children?: ReactNode;
}

const INSTANT = { duration: 0 } as const;

export function StatusList(props: StatusListProps) {
  const { order, statuses, counts, editingId, onEdit, renderEditor, rowRef } = props;
  const hintId = useId();
  const reducedMotion = usePrefersReducedMotion();
  const items = order.ids.flatMap((id) => statuses.get(id) ?? []);
  const move = (status: Status, delta: number) => {
    const next = moveInOrder(order.ids, status.id, delta);
    if (!next) return;
    order.commit(next);
    announce(`${status.name} moved to position ${next.indexOf(status.id) + 1} of ${next.length}`);
  };
  return (
    <>
      <span id={hintId} className="visually-hidden">
        Drag, or press the up and down arrow keys, to change the order.
      </span>
      <GroupedCard>
        {/* Rows animate relative to the list: the phone sheet grows and shrinks upward with
            its content, which would otherwise read as every row above the change moving. */}
        <Reorder.Group
          as="ul"
          axis="y"
          values={order.ids}
          onReorder={order.preview}
          className={styles.list}
          layout
          layoutRoot
        >
          {items.map((status) => (
            <StatusListRow
              key={status.id}
              status={status}
              count={counts.get(status.id) ?? 0}
              editor={status.id === editingId ? renderEditor(status) : null}
              dragDisabled={props.dragDisabled}
              hintId={hintId}
              transition={reducedMotion ? INSTANT : undefined}
              onEdit={() => onEdit(status.id)}
              onMove={(delta) => move(status, delta)}
              onDragEnd={order.commitPreview}
              rowRef={rowRef(status.id)}
            />
          ))}
        </Reorder.Group>
        {props.children}
      </GroupedCard>
    </>
  );
}
