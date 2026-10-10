import clsx from 'clsx';
import { memo, useState, type CSSProperties } from 'react';
import { Icon } from '../../components';
import { LinkedText } from '../ticket/activity/LinkedText';
import { textLines } from './stepClamp';
import { REFUSED_SUFFIX, STEPS_LIST_LABEL } from './stepCopy';
import { stepIcon } from './stepIcon';
import styles from './StepList.module.css';
import type { StepRow } from './stepRows';
import type { StepVariant } from './stepVariant';

export interface StepListProps {
  id?: string | undefined;
  rows: StepRow[];
  variant: StepVariant;
}

interface StepItemProps {
  row: StepRow;
  variant: StepVariant;
  lines: number | null;
  arrived: boolean;
}

function StepItemView({ row, variant, lines, arrived }: StepItemProps) {
  const clamp = lines === null ? undefined : ({ '--step-lines': lines } as CSSProperties);
  return (
    <li
      className={clsx(
        styles.step,
        styles[row.kind],
        row.subAgent && styles.sub,
        row.refused && styles.refused,
        lines !== null && styles.clamped,
        arrived && 'fade-in',
      )}
      style={clamp}
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

// A step never changes once sent, so a row with the same seq renders the same: each new step then
// renders only itself and the row whose cut changed, not the whole list.
const StepItem = memo(
  StepItemView,
  (before, after) =>
    before.row.seq === after.row.seq &&
    before.row.refused === after.row.refused &&
    before.variant === after.variant &&
    before.lines === after.lines &&
    before.arrived === after.arrived,
);

export function StepList({ id, rows, variant }: StepListProps) {
  // Steps there when the list first shows come in with it; only later ones fade in on their own.
  const [shownUpTo] = useState(() => rows.at(-1)?.seq ?? 0);
  return (
    <ol id={id} className={clsx(styles.list, styles[variant])} aria-label={STEPS_LIST_LABEL}>
      {rows.map((row, index) => (
        <StepItem
          key={row.seq}
          row={row}
          variant={variant}
          lines={textLines(variant, row, index === rows.length - 1)}
          arrived={row.seq > shownUpTo}
        />
      ))}
    </ol>
  );
}
