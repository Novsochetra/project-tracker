import clsx from 'clsx';
import { useId, useRef, useState } from 'react';
import { DatePicker } from '../DatePicker';
import { ClearOrChevron, DateFace, type DateRowProps } from './DateRowParts';
import styles from './PropertyRow.module.css';

// The row is one button under the clear button, as the native input was, so a click anywhere on
// it opens the calendar; its name is the label and the value, like the Status row's.
export function CalendarDateRow({
  value,
  onChange,
  label = 'Due date',
  overdue = false,
  mutedIcon = false,
  className,
}: DateRowProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  const clear = () => {
    onChange('');
    triggerRef.current?.focus({ preventScroll: true });
  };
  return (
    <div className={clsx('ring-inside', styles.row, className)}>
      <DateFace
        value={value}
        label={label}
        overdue={overdue}
        mutedIcon={mutedIcon}
        nameOf={{ labelId: `${id}-label`, valueId: `${id}-value` }}
      />
      <button
        ref={triggerRef}
        type="button"
        className={styles.dateTrigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-labelledby={`${id}-label ${id}-value`}
        onClick={() => setOpen(true)}
      />
      <ClearOrChevron value={value} label={label} onClear={clear} />
      <DatePicker
        open={open}
        anchorRef={triggerRef}
        value={value}
        label={label}
        onPick={onChange}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
