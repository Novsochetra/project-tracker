import type { AskModel } from '@tracker/shared';
import { ChevronDown } from 'lucide-react';
import { useRef, useState } from 'react';
import { Dropdown, Icon } from '../../components';
import styles from './AskOptionsRow.module.css';
import { MODEL_OPTIONS } from './askOptions';
import { MODEL_LABEL } from './copy';

export interface ModelChipProps {
  value: AskModel;
  onChange: (value: AskModel) => void;
}

export function ModelChip({ value, onChange }: ModelChipProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const current = MODEL_OPTIONS.find((option) => option.value === value);
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
        <span className="visually-hidden">{MODEL_LABEL}</span>{' '}
        <span className={styles.value}>{current?.label}</span>
        <Icon icon={ChevronDown} size={14} className={styles.chevron} />
      </button>
      <Dropdown
        open={open}
        anchorRef={triggerRef}
        label={MODEL_LABEL}
        options={MODEL_OPTIONS}
        value={value}
        onSelect={onChange}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
