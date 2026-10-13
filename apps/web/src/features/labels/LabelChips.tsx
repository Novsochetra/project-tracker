import type { Label } from '@tracker/shared';
import clsx from 'clsx';
import { LabelDot } from './LabelDot';
import styles from './LabelChips.module.css';

export interface LabelChipsProps {
  labels: readonly Label[];
  className?: string | undefined;
}

export function LabelChips({ labels, className }: LabelChipsProps) {
  if (labels.length === 0) return null;
  return (
    <span className={clsx(styles.chips, className)}>
      {labels.map((label) => (
        <span key={label.id} className={styles.chip}>
          <LabelDot color={label.color} />
          <span className={styles.name}>{label.name}</span>
        </span>
      ))}
    </span>
  );
}

// Only the colors, where a row has no room for names; the names stay for screen readers.
export function LabelDots({ labels, className }: LabelChipsProps) {
  if (labels.length === 0) return null;
  return (
    <span className={clsx(styles.dots, className)}>
      {labels.map((label) => (
        <LabelDot key={label.id} color={label.color} className={styles.small} />
      ))}
      <span className="visually-hidden">{labels.map((label) => label.name).join(', ')}</span>
    </span>
  );
}
