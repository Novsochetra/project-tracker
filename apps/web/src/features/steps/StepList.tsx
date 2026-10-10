import clsx from 'clsx';
import { useState } from 'react';
import { STEPS_LIST_LABEL } from './stepCopy';
import { StepItem } from './StepItem';
import styles from './StepList.module.css';
import type { StepRow } from './stepRows';
import type { StepVariant } from './stepVariant';

export interface StepListProps {
  id?: string | undefined;
  rows: StepRow[];
  variant: StepVariant;
  leaving?: StepRow[];
}

export function StepList({ id, rows, variant, leaving = [] }: StepListProps) {
  // Steps there when the list first shows come in with it; only later ones fade in on their own.
  const [shownUpTo] = useState(() => rows.at(-1)?.seq ?? 0);
  // One keyed list: a row that starts to leave keeps its node, so it folds from where it is.
  const items = [
    ...leaving.map((row) => ({ row, isLeaving: true })),
    ...rows.map((row) => ({ row, isLeaving: false })),
  ];
  return (
    <ol id={id} className={clsx(styles.list, styles[variant])} aria-label={STEPS_LIST_LABEL}>
      {items.map(({ row, isLeaving }) => (
        <StepItem
          key={row.seq}
          row={row}
          variant={variant}
          arrived={row.seq > shownUpTo}
          leaving={isLeaving}
        />
      ))}
    </ol>
  );
}
