import { VERDICT_LABELS, type ReviewVerdict } from '@tracker/shared';
import clsx from 'clsx';
import { Check, RotateCcw } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useMediaQuery } from '../../lib/media';
import { Icon } from '../Icon';
import { chipTextColor } from './chipText';
import styles from './VerdictChip.module.css';

export interface VerdictChipProps {
  verdict: ReviewVerdict;
  // The Reviewed status color, so an approval looks like where it moved the ticket.
  approvedColor?: string | undefined;
  // A ticket row's line is narrow, so there only the icon shows below 1024px.
  compact?: boolean;
  className?: string | undefined;
}

// Where VerdictChip.module.css hides a compact chip's label.
export const ICON_ONLY_QUERY = '(max-width: 1023px)';

const statusColors = (color: string) =>
  ({ '--verdict': color, '--verdict-text': chipTextColor(color) }) as CSSProperties;

export function VerdictChip({
  verdict,
  approvedColor,
  compact = false,
  className,
}: VerdictChipProps) {
  const approved = verdict === 'approved';
  // Mouse users in a desktop window under 1024px see only the icon; the label stays in the row's
  // accessible name, so the tooltip adds nothing for screen readers.
  const iconOnly = useMediaQuery(ICON_ONLY_QUERY) && compact;
  return (
    <span
      data-verdict={verdict}
      title={iconOnly ? VERDICT_LABELS[verdict] : undefined}
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
