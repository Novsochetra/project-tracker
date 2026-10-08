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
  nameOf?: { labelId: string; valueId: string };
}

// A button named by the label and value (nameOf) reads them itself, so screen readers skip the
// text here; otherwise browse mode reads the date twice.
export function DateFace({ value, label, overdue, mutedIcon, nameOf }: DateFaceProps) {
  const tone = overdue ? styles.overdue : value ? styles.set : styles.unset;
  const hidden = nameOf ? true : undefined;
  return (
    <>
      <span className={clsx(styles.icon, mutedIcon && !overdue ? styles.mutedIcon : tone)}>
        <Icon icon={Calendar} />
      </span>
      <span id={nameOf?.labelId} aria-hidden={hidden} className={styles.label}>
        {label}
      </span>
      <span id={nameOf?.valueId} aria-hidden={hidden} className={clsx(styles.value, tone)}>
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
