import clsx from 'clsx';
import { useRef, type KeyboardEvent, type MouseEvent } from 'react';
import { useCalendarPicker } from '../DatePicker';
import { CalendarDateRow } from './CalendarDateRow';
import { ClearOrChevron, DateFace, type DateRowProps } from './DateRowParts';
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
        type="date"
        className={styles.dateInput}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        onClick={openPicker}
        onKeyDown={openPickerOnSpace}
      />
      <ClearOrChevron value={value} label={label} onClear={clear} />
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
