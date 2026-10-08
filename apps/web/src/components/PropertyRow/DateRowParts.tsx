import { formatLongDay } from '@tracker/shared';
import clsx from 'clsx';
import { Calendar, ChevronDown, X } from 'lucide-react';
import { Icon } from '../Icon';
import styles from './PropertyRow.module.css';

export interface DateRowProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  overdue?: boolean;
  mutedIcon?: boolean;
  className?: string | undefined;
}

interface DateFaceProps {
  value: string;
  label: string;
  overdue: boolean;
  mutedIcon: boolean;
  labelId?: string;
  valueId?: string;
}

export function DateFace({ value, label, overdue, mutedIcon, labelId, valueId }: DateFaceProps) {
  const tone = overdue ? styles.overdue : value ? styles.set : styles.unset;
  return (
    <>
      <span className={clsx(styles.icon, mutedIcon && !overdue ? styles.mutedIcon : tone)}>
        <Icon icon={Calendar} />
      </span>
      <span id={labelId} className={styles.label}>
        {label}
      </span>
      <span id={valueId} className={clsx(styles.value, tone)}>
        {value ? formatLongDay(value) : 'None'}
      </span>
    </>
  );
}

interface ClearOrChevronProps {
  value: string;
  label: string;
  onClear: () => void;
}

export function ClearOrChevron({ value, label, onClear }: ClearOrChevronProps) {
  if (!value) return <Icon icon={ChevronDown} className={styles.chevron} />;
  return (
    <button
      type="button"
      className={styles.clear}
      aria-label={`Clear ${label.toLowerCase()}`}
      onClick={onClear}
    >
      <Icon icon={X} size={14} />
    </button>
  );
}
