import type { Status } from '@tracker/shared';
import clsx from 'clsx';
import { ChevronRight, GripVertical } from 'lucide-react';
import { Reorder, useDragControls, type Transition } from 'motion/react';
import { useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { Icon, StatusGlyph } from '../../components';
import styles from './StatusManagerSheet.module.css';
import { categoryHint } from './statusForm';
import { useOwnTouch } from './useOwnTouch';

export interface StatusListRowProps {
  status: Status;
  count: number;
  editor: ReactNode;
  dragDisabled: boolean;
  hintId: string;
  transition: Transition | undefined;
  onEdit: () => void;
  onMove: (delta: number) => void;
  onDragEnd: () => void;
  rowRef: (element: HTMLButtonElement | null) => void;
}

const KEY_DELTAS: Partial<Record<string, number>> = { ArrowUp: -1, ArrowDown: 1 };

export function StatusListRow(props: StatusListRowProps) {
  const { status, editor, transition, onDragEnd } = props;
  const controls = useDragControls();
  const [dragging, setDragging] = useState(false);
  return (
    <Reorder.Item
      as="li"
      value={status.id}
      layout="position"
      transition={transition}
      dragListener={false}
      dragControls={controls}
      className={styles.item}
      data-dragging={dragging ? '' : undefined}
      onDragStart={() => setDragging(true)}
      onDragEnd={() => {
        setDragging(false);
        onDragEnd();
      }}
    >
      {editor ?? <RowContent {...props} startDrag={(event) => controls.start(event)} />}
    </Reorder.Item>
  );
}

interface RowContentProps extends StatusListRowProps {
  startDrag: (event: PointerEvent) => void;
}

function RowContent({
  status,
  count,
  dragDisabled,
  hintId,
  onEdit,
  onMove,
  rowRef,
  startDrag,
}: RowContentProps) {
  const handleRef = useOwnTouch<HTMLButtonElement>();
  const hint = categoryHint(status);
  const moveByKey = (event: KeyboardEvent) => {
    const delta = KEY_DELTAS[event.key];
    if (!delta) return;
    event.preventDefault();
    onMove(delta);
  };
  return (
    <>
      <button
        ref={handleRef}
        type="button"
        className={styles.handle}
        aria-label={`Reorder ${status.name}`}
        aria-describedby={hintId}
        data-no-swipe=""
        disabled={dragDisabled}
        onPointerDown={(event) => {
          if (!dragDisabled) startDrag(event);
        }}
        onKeyDown={moveByKey}
      >
        <Icon icon={GripVertical} />
      </button>
      <button
        ref={rowRef}
        type="button"
        className={clsx('ring-inside', styles.row)}
        onClick={onEdit}
      >
        <StatusGlyph category={status.category} color={status.color} animated={false} />
        <span className={styles.name}>{status.name}</span>
        {hint && <span className={styles.category}>{hint}</span>}
        <span className={styles.count}>
          {count}
          <span className="visually-hidden">{count === 1 ? ' ticket' : ' tickets'}</span>
        </span>
        <Icon icon={ChevronRight} className={styles.chevron} />
      </button>
    </>
  );
}
