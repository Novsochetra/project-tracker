import { ChevronDown } from 'lucide-react';
import { useRef, useState } from 'react';
import { Dropdown, Icon, type DropdownOption } from '../../../components';
import styles from './DetailChips.module.css';

export interface SelectChipProps<T extends string> {
  label: string;
  options: readonly DropdownOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

// Named like the desktop row it stands for ("Status In progress"), with the label left unseen:
// the glyph or the bars say what the value is.
export function SelectChip<T extends string>({
  label,
  options,
  value,
  onChange,
}: SelectChipProps<T>) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const current = options.find((option) => option.value === value);
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles.chip}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        <span className={styles.icon}>{current?.icon}</span>
        <span className="visually-hidden">{label}</span>{' '}
        <span className={styles.value}>{current?.label}</span>
        <Icon icon={ChevronDown} size={14} className={styles.chevron} />
      </button>
      <Dropdown
        open={open}
        anchorRef={triggerRef}
        label={label}
        options={options}
        value={value}
        onSelect={onChange}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
