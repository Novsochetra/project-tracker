import { formatLongDay } from '@tracker/shared';
import clsx from 'clsx';
import { Calendar, ChevronDown, X } from 'lucide-react';
import { useRef } from 'react';
import { Icon, nativeDatePicker } from '../../../components';
import styles from './DetailChips.module.css';

export interface DueChipProps {
  value: string;
  overdue: boolean;
  onChange: (value: string) => void;
}

const LABEL = 'Due date';

// The native date input covers the chip, so a tap anywhere opens the phone's own picker; the
// clear button sits above it.
export function DueChip({ value, overdue, onChange }: DueChipProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const tone = overdue ? styles.overdue : value ? styles.set : styles.unset;
  const clear = () => {
    onChange('');
    inputRef.current?.focus({ preventScroll: true });
  };
  return (
    <label className={clsx(styles.chip, styles.due, overdue && styles.late)}>
      <Icon icon={Calendar} className={clsx(styles.icon, tone)} />
      <span className={clsx(styles.value, tone)}>{value ? formatLongDay(value) : LABEL}</span>
      <input
        ref={inputRef}
        className={styles.dateInput}
        value={value}
        {...nativeDatePicker(LABEL, onChange)}
      />
      {value ? (
        <button type="button" className={styles.clear} aria-label="Clear due date" onClick={clear}>
          <Icon icon={X} size={14} />
        </button>
      ) : (
        <Icon icon={ChevronDown} size={14} className={styles.chevron} />
      )}
    </label>
  );
}
