import { useRef, useState, type ReactNode } from 'react';
import { Dropdown, type DropdownOption } from '../Dropdown';
import { PropertyRow } from '../PropertyRow';

export interface SelectRowProps<T extends string> {
  label: string;
  options: readonly DropdownOption<T>[];
  value: T;
  onChange: (value: T) => void;
  icon?: ReactNode;
  disabled?: boolean;
  className?: string | undefined;
  title?: string | undefined;
}

export function SelectRow<T extends string>({
  label,
  options,
  value,
  onChange,
  icon,
  disabled = false,
  className,
  title,
}: SelectRowProps<T>) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const current = options.find((option) => option.value === value);
  return (
    <>
      <PropertyRow
        ref={triggerRef}
        icon={icon ?? current?.icon}
        label={label}
        value={current?.label ?? ''}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        className={className}
        title={title}
        onClick={() => setOpen((isOpen) => !isOpen)}
      />
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
