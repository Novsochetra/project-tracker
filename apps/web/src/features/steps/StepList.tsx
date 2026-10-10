import clsx from 'clsx';
import { useState } from 'react';
import { Icon } from '../../components';
import { LinkedText } from '../ticket/activity/LinkedText';
import { REFUSED_SUFFIX, STEPS_LIST_LABEL } from './stepCopy';
import { stepIcon } from './stepIcon';
import styles from './StepList.module.css';
import type { StepRow } from './stepRows';

// Live: the working message, one line a call and Claude's words whole. History: a folded answer's
// steps, where Claude's words are a quiet line like a call, since the last of them is the answer
// shown right under it. Full: a ticket run's sheet, where nothing is cut.
export type StepVariant = 'live' | 'history' | 'full';

export interface StepListProps {
  id?: string | undefined;
  rows: StepRow[];
  variant: StepVariant;
}

interface StepItemProps {
  row: StepRow;
  variant: StepVariant;
  arrived: boolean;
}

function StepItem({ row, variant, arrived }: StepItemProps) {
  return (
    <li
      className={clsx(
        styles.step,
        styles[row.kind],
        row.subAgent && styles.sub,
        row.refused && styles.refused,
        arrived && 'fade-in',
      )}
    >
      {(row.kind !== 'text' || variant === 'history') && (
        <Icon icon={stepIcon(row)} size={14} className={styles.icon} />
      )}
      <span className={styles.label}>
        {row.kind === 'text' ? <LinkedText text={row.label} /> : row.label}
      </span>
      {row.refused && <span className="visually-hidden">{`, ${REFUSED_SUFFIX}`}</span>}
    </li>
  );
}

export function StepList({ id, rows, variant }: StepListProps) {
  // Steps there when the list first shows come in with it; only later ones fade in on their own.
  const [shownUpTo] = useState(() => rows.at(-1)?.seq ?? 0);
  return (
    <ol id={id} className={clsx(styles.list, styles[variant])} aria-label={STEPS_LIST_LABEL}>
      {rows.map((row) => (
        <StepItem key={row.seq} row={row} variant={variant} arrived={row.seq > shownUpTo} />
      ))}
    </ol>
  );
}
