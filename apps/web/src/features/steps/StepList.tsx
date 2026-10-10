import clsx from 'clsx';
import { useCallback, useState } from 'react';
import { isCut } from './stepClamp';
import { STEPS_LIST_LABEL } from './stepCopy';
import { StepItem } from './StepItem';
import styles from './StepList.module.css';
import type { StepRow } from './stepRows';
import type { StepVariant } from './stepVariant';

export interface StepListProps {
  id?: string | undefined;
  rows: StepRow[];
  variant: StepVariant;
  whole?: boolean;
  leaving?: StepRow[];
  onLeft?: (seq: number) => void;
}

const ignore = () => undefined;

function useOpened() {
  const [opened, setOpened] = useState<ReadonlySet<number>>(() => new Set());
  const toggle = useCallback(
    (seq: number) =>
      setOpened((current) => {
        const next = new Set(current);
        if (!next.delete(seq)) next.add(seq);
        return next;
      }),
    [],
  );
  return { opened, toggle };
}

export function StepList({
  id,
  rows,
  variant,
  whole = false,
  leaving = [],
  onLeft = ignore,
}: StepListProps) {
  // Steps there when the list first shows come in with it; only later ones fade in on their own.
  const [shownUpTo] = useState(() => rows.at(-1)?.seq ?? 0);
  const { opened, toggle } = useOpened();
  const item = (row: StepRow, newest: boolean, isLeaving: boolean) => (
    <StepItem
      key={row.seq}
      row={row}
      variant={variant}
      cuttable={isCut(variant, row, { newest, whole })}
      opened={opened.has(row.seq)}
      arrived={row.seq > shownUpTo}
      leaving={isLeaving}
      onToggle={toggle}
      onLeft={onLeft}
    />
  );
  return (
    <ol id={id} className={clsx(styles.list, styles[variant])} aria-label={STEPS_LIST_LABEL}>
      {leaving.map((row) => item(row, false, true))}
      {rows.map((row, index) => item(row, index === rows.length - 1, false))}
    </ol>
  );
}
