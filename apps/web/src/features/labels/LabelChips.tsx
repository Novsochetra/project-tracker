import type { Label } from '@tracker/shared';
import clsx from 'clsx';
import type { CSSProperties } from 'react';
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
        <span key={label.id} className={styles.chip} style={chipColor(label, compact)}>
          {!compact && <LabelDot color={label.color} />}
          <span className={styles.name}>{label.name}</span>
        </span>
      ))}
    </span>
  );
}

// A compact chip is tinted with its label's color instead of a dot, so a phone row at 320px has
// room for a few letters of its name ("v1.4") beside a date with a year.
const chipColor = (label: Label, compact: boolean): CSSProperties | undefined =>
  compact ? ({ '--chip-color': label.color } as CSSProperties) : undefined;

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
