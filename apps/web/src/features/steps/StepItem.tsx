import clsx from 'clsx';
import { memo } from 'react';
import { Icon } from '../../components';
import { LinkedText } from '../ticket/activity/LinkedText';
import { REFUSED_SUFFIX } from './stepCopy';
import { stepIcon } from './stepIcon';
import styles from './StepList.module.css';
import type { StepRow } from './stepRows';
import type { StepVariant } from './stepVariant';

export interface StepItemProps {
  row: StepRow;
  variant: StepVariant;
  arrived: boolean;
  leaving: boolean;
}

function StepItemView({ row, variant, arrived, leaving }: StepItemProps) {
  return (
    <li
      aria-hidden={leaving || undefined}
      data-leaving={leaving ? '' : undefined}
      data-seq={row.seq}
      className={clsx(
        styles.step,
        styles[row.kind],
        row.subAgent && styles.sub,
        row.refused && styles.refused,
        leaving && styles.leaving,
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

// A step never changes once sent, so a row with the same seq renders the same: each new step then
// renders only itself and the rows that start to leave, not the whole list.
export const StepItem = memo(
  StepItemView,
  (before, after) =>
    before.row.seq === after.row.seq &&
    before.row.refused === after.row.refused &&
    before.variant === after.variant &&
    before.arrived === after.arrived &&
    before.leaving === after.leaving,
);
