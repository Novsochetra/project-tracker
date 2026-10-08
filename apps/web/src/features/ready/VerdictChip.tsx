import type { ReviewVerdict } from '@tracker/shared';
import clsx from 'clsx';
import { Check, RotateCcw } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Icon } from '../../components';
import { VERDICT_LABELS } from '../ticket/activity/activityItems';
import styles from './VerdictChip.module.css';

export interface VerdictChipProps {
  verdict: ReviewVerdict;
  // The Reviewed status color, so an approval looks like where it moved the ticket.
  approvedColor?: string | undefined;
}

export function VerdictChip({ verdict, approvedColor }: VerdictChipProps) {
  const approved = verdict === 'approved';
  const color = approved && approvedColor ? ({ '--verdict': approvedColor } as CSSProperties) : {};
  return (
    <span className={clsx(styles.chip, approved ? styles.approved : styles.changes)} style={color}>
      <Icon icon={approved ? Check : RotateCcw} size={14} />
      {VERDICT_LABELS[verdict]}
    </span>
  );
}
