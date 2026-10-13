import { Reorder } from 'motion/react';
import { useId, type ReactNode } from 'react';
import { announce } from '../../app/announce';
import { GroupedCard } from '../../components';
import { usePrefersReducedMotion } from '../../lib/media';
import { OrderedListRow, type OrderedItem } from './OrderedListRow';
import styles from './StatusManagerSheet.module.css';
import { moveInOrder } from './statusForm';
import type { SavedOrder } from './useSavedOrder';

export interface OrderedListProps<T extends OrderedItem> {
  order: SavedOrder;
  items: ReadonlyMap<string, T>;
  counts: ReadonlyMap<string, number>;
  editingId: string | null;
  dragDisabled: boolean;
  leading: (item: T) => ReactNode;
  hint?: (item: T) => string | null;
  onEdit: (id: string) => void;
  renderEditor: (item: T) => ReactNode;
  rowRef: (id: string) => (element: HTMLButtonElement | null) => void;
  children?: ReactNode;
}

const INSTANT = { duration: 0 } as const;

export function OrderedList<T extends OrderedItem>(props: OrderedListProps<T>) {
  const { order, items, counts, editingId, onEdit, renderEditor, rowRef } = props;
  const hintId = useId();
  const reducedMotion = usePrefersReducedMotion();
  const shown = order.ids.flatMap((id) => items.get(id) ?? []);
  const move = (item: T, delta: number) => {
    const next = moveInOrder(order.ids, item.id, delta);
    if (!next) return;
    order.commit(next);
    announce(`${item.name} moved to position ${next.indexOf(item.id) + 1} of ${next.length}`);
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
          {shown.map((item) => (
            <OrderedListRow
              key={item.id}
              item={item}
              leading={props.leading(item)}
              hint={props.hint?.(item) ?? null}
              count={counts.get(item.id) ?? 0}
              editor={item.id === editingId ? renderEditor(item) : null}
              dragDisabled={props.dragDisabled}
              hintId={hintId}
              transition={reducedMotion ? INSTANT : undefined}
              onEdit={() => onEdit(item.id)}
              onMove={(delta) => move(item, delta)}
              onDragEnd={order.commitPreview}
              rowRef={rowRef(item.id)}
            />
          ))}
        </Reorder.Group>
        {props.children}
      </GroupedCard>
    </>
  );
}
