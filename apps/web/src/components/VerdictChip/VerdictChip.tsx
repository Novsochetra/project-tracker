import { VERDICT_LABELS, type ReviewVerdict } from '@tracker/shared';
import clsx from 'clsx';
import { Check, RotateCcw } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Icon } from '../Icon';
import { chipTextColor } from './chipText';
import styles from './VerdictChip.module.css';

export interface VerdictChipProps {
  verdict: ReviewVerdict;
  // The Reviewed status color, so an approval looks like where it moved the ticket.
  approvedColor?: string | undefined;
  // For a ticket row's narrow line: below 1024px only the icon shows.
  compact?: boolean;
  className?: string | undefined;
}

const statusColors = (color: string) =>
  ({ '--verdict': color, '--verdict-text': chipTextColor(color) }) as CSSProperties;

export function VerdictChip({
  verdict,
  approvedColor,
  compact = false,
  className,
}: VerdictChipProps) {
  const approved = verdict === 'approved';
  return (
    <span
      data-verdict={verdict}
      className={clsx(
        styles.chip,
        approved ? styles.approved : styles.changes,
        compact && styles.compact,
        className,
      )}
      style={approved && approvedColor ? statusColors(approvedColor) : undefined}
    >
      <Icon icon={approved ? Check : RotateCcw} size={14} />
      <span className={styles.label}>{VERDICT_LABELS[verdict]}</span>
    </span>
  );
}
