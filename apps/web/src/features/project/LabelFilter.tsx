import { sortLabels, type Label } from '@tracker/shared';
import { ChevronDown, Tag } from 'lucide-react';
import { useRef, useState } from 'react';
import { Dropdown, Icon, type DropdownOption } from '../../components';
import { LabelDot } from '../labels/LabelDot';
import styles from './LabelFilter.module.css';

export interface LabelFilterProps {
  labels: readonly Label[];
  picked: Label | undefined;
  onChange: (labelId: string | null) => void;
}

const ALL_LABELS = 'all';

const labelOptions = (labels: readonly Label[]): DropdownOption[] => [
  { value: ALL_LABELS, label: 'All labels', icon: <Icon icon={Tag} size={14} /> },
  ...sortLabels(labels).map((label) => ({
    value: label.id,
    label: label.name,
    icon: <LabelDot color={label.color} />,
  })),
];

// Beside the status tabs, so a label narrows whichever status the list shows.
export function LabelFilter({ labels, picked, onChange }: LabelFilterProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={picked ? `Label ${picked.name}` : 'Filter by label'}
        data-picked={picked ? '' : undefined}
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        {picked ? <LabelDot color={picked.color} /> : <Icon icon={Tag} />}
        {picked && <span className={styles.name}>{picked.name}</span>}
        <Icon icon={ChevronDown} size={14} className={styles.chevron} />
      </button>
      <Dropdown
        open={open}
        anchorRef={triggerRef}
        label="Label"
        options={labelOptions(labels)}
        value={picked?.id ?? ALL_LABELS}
        onSelect={(value) => onChange(value === ALL_LABELS ? null : value)}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
