import clsx from 'clsx';
import { useRef } from 'react';
import { useCalendarPicker } from '../DatePicker';
import { CalendarDateRow } from './CalendarDateRow';
import { ClearOrChevron, DateFace, type DateRowProps } from './DateRowParts';
import { nativeDatePicker } from './nativeDatePicker';
import styles from './PropertyRow.module.css';

export type { DateRowProps } from './DateRowParts';

// Desktop gets the app's calendar instead of the SPEC's native picker (docs/architecture.md §1.7).
export function DateRow(props: DateRowProps) {
  const calendar = useCalendarPicker();
  return calendar ? <CalendarDateRow {...props} /> : <NativeDateRow {...props} />;
}

function NativeDateRow({
  value,
  onChange,
  label = 'Due date',
  overdue = false,
  mutedIcon = false,
  className,
}: DateRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const clear = () => {
    onChange('');
    inputRef.current?.focus({ preventScroll: true });
  };
  return (
    <label className={clsx('ring-inside', styles.row, className)}>
      <DateFace value={value} label={label} overdue={overdue} mutedIcon={mutedIcon} />
      <input
        ref={inputRef}
        className={styles.dateInput}
        value={value}
        {...nativeDatePicker(label, onChange)}
      />
      <ClearOrChevron value={value} label={label} onClear={clear} />
    </label>
  );
}
