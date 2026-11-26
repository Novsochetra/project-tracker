import type { Label } from '@tracker/shared';
import clsx from 'clsx';
import { LabelDot } from './LabelDot';
import styles from './LabelChips.module.css';

export interface LabelChipsProps {
  labels: readonly Label[];
  compact?: boolean;
  className?: string | undefined;
}

export function LabelChips({ labels, compact = false, className }: LabelChipsProps) {
  if (labels.length === 0) return null;
  return (
    <span className={clsx(styles.chips, compact && styles.compact, className)}>
      {labels.map((label) => (
        <span key={label.id} className={styles.chip}>
          <LabelDot color={label.color} className={styles.chipDot} />
          <span className={styles.name}>{label.name}</span>
        </span>
      ))}
    </span>
  );
}

// The phone's Labels chip has no room for the names, but screen readers still need them.
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
