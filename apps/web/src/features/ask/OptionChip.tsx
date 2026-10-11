import { ChevronDown, type LucideIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { Dropdown, Icon, type DropdownOption } from '../../components';
import styles from './AskOptionsRow.module.css';

export interface OptionChipProps<T extends string> {
  label: string;
  options: readonly DropdownOption<T>[];
  value: T;
  onChange: (value: T) => void;
  // Tells two chips apart when both show Default.
  icon?: LucideIcon;
}

export function OptionChip<T extends string>({
  label,
  options,
  value,
  onChange,
  icon,
}: OptionChipProps<T>) {
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
        {icon && <Icon icon={icon} size={14} className={styles.icon} />}
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
