import { formatLongDay } from '@tracker/shared';
import clsx from 'clsx';
import { Calendar, ChevronDown, X } from 'lucide-react';
import { useRef, type KeyboardEvent, type MouseEvent } from 'react';
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

export function DateRow({
  value,
  onChange,
  label = 'Due date',
  overdue = false,
  mutedIcon = false,
  className,
}: DateRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const tone = overdue ? styles.overdue : value ? styles.set : styles.unset;
  const clear = () => {
    onChange('');
    inputRef.current?.focus({ preventScroll: true });
  };
  return (
    <label className={clsx('ring-inside', styles.row, className)}>
      <span className={clsx(styles.icon, mutedIcon && !overdue ? styles.mutedIcon : tone)}>
        <Icon icon={Calendar} />
      </span>
      <span className={styles.label}>{label}</span>
      <span className={clsx(styles.value, tone)}>{value ? formatLongDay(value) : 'None'}</span>
      <input
        ref={inputRef}
        type="date"
        className={styles.dateInput}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        onClick={openPicker}
        onKeyDown={openPickerOnSpace}
      />
      {value ? (
        <button
          type="button"
          className={styles.clear}
          aria-label={`Clear ${label.toLowerCase()}`}
          onClick={clear}
        >
          <Icon icon={X} size={14} />
        </button>
      ) : (
        <Icon icon={ChevronDown} className={styles.chevron} />
      )}
    </label>
  );
}

function showPicker(input: HTMLInputElement) {
  try {
    input.showPicker();
  } catch {
    // Browsers without showPicker, or that refuse it here, still open their own picker.
  }
}

function openPicker(event: MouseEvent<HTMLInputElement>) {
  showPicker(event.currentTarget);
}

function openPickerOnSpace(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key !== ' ') return;
  event.preventDefault();
  showPicker(event.currentTarget);
}
