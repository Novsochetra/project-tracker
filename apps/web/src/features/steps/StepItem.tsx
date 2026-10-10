import clsx from 'clsx';
import { memo, useRef, type CSSProperties } from 'react';
import { Icon } from '../../components';
import { LinkedText } from '../ticket/activity/LinkedText';
import { LIVE_TEXT_LINES } from './stepClamp';
import { REFUSED_SUFFIX } from './stepCopy';
import { stepIcon } from './stepIcon';
import styles from './StepList.module.css';
import type { StepRow } from './stepRows';
import type { StepVariant } from './stepVariant';
import { useRowLeave, useRowShrink } from './useRowMotion';

export interface StepItemProps {
  row: StepRow;
  variant: StepVariant;
  cuttable: boolean;
  opened: boolean;
  arrived: boolean;
  leaving: boolean;
  onToggle: (seq: number) => void;
  onLeft: (seq: number) => void;
}

const CUT_STYLE = { '--step-lines': LIVE_TEXT_LINES } as CSSProperties;

// A cut row is a button whose name is all of its words, so a screen reader reads them whole; it
// holds them as plain text, since links can't sit in a button. The cut is on a span inside it:
// WebKit doesn't clamp the lines of a button.
function Words({ row, cuttable, opened, onToggle }: StepItemProps) {
  if (!cuttable) return <LinkedText text={row.label} />;
  return (
    <button
      type="button"
      className={`${styles.open} ring-inside`}
      aria-expanded={opened}
      onClick={() => onToggle(row.seq)}
    >
      <span className={styles.words}>{row.label}</span>
    </button>
  );
}

function StepItemView(props: StepItemProps) {
  const { row, variant, cuttable, opened, arrived, leaving, onLeft } = props;
  const ref = useRef<HTMLLIElement>(null);
  const cut = cuttable && !opened;
  useRowShrink(ref, cut);
  useRowLeave(ref, { leaving, seq: row.seq, onLeft });
  return (
    <li
      ref={ref}
      aria-hidden={leaving || undefined}
      className={clsx(
        styles.step,
        styles[row.kind],
        row.subAgent && styles.sub,
        row.refused && styles.refused,
        cut && styles.clamped,
        leaving && styles.leaving,
        arrived && 'fade-in',
      )}
      style={cut ? CUT_STYLE : undefined}
    >
      {(row.kind !== 'text' || variant === 'history') && (
        <Icon icon={stepIcon(row)} size={14} className={styles.icon} />
      )}
      <span className={styles.label}>{row.kind === 'text' ? <Words {...props} /> : row.label}</span>
      {row.refused && <span className="visually-hidden">{`, ${REFUSED_SUFFIX}`}</span>}
    </li>
  );
}

// A step never changes once sent, so a row with the same seq renders the same: each new step then
// renders only itself and the rows whose cut or place changed, not the whole list.
export const StepItem = memo(
  StepItemView,
  (before, after) =>
    before.row.seq === after.row.seq &&
    before.row.refused === after.row.refused &&
    before.variant === after.variant &&
    before.cuttable === after.cuttable &&
    before.opened === after.opened &&
    before.arrived === after.arrived &&
    before.leaving === after.leaving,
);
