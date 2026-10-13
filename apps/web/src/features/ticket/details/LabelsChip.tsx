import { labelNames, labelsOf, type Label } from '@tracker/shared';
import clsx from 'clsx';
import { ChevronDown, Tag } from 'lucide-react';
import { useRef, useState } from 'react';
import { Icon } from '../../../components';
import { LabelDots } from '../../labels/LabelChips';
import { LabelMenu } from '../../labels/LabelMenu';
import styles from './DetailChips.module.css';

export interface LabelsChipProps {
  labels: readonly Label[];
  value: readonly string[];
  onChange: (labelIds: string[]) => void;
}

// Named like the desktop row it stands for ("Labels Bug, UI").
export function LabelsChip({ labels, value, onChange }: LabelsChipProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const picked = labelsOf(labels, value);
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
        <span className={styles.icon} aria-hidden="true">
          {picked.length > 0 ? <LabelDots labels={picked} /> : <Icon icon={Tag} />}
        </span>
        <span className="visually-hidden">Labels</span>{' '}
        <span className={clsx(styles.value, picked.length === 0 && styles.unset)}>
          {labelNames(picked) || 'No labels'}
        </span>
        <Icon icon={ChevronDown} size={14} className={styles.chevron} />
      </button>
      <LabelMenu
        open={open}
        anchorRef={triggerRef}
        labels={labels}
        value={value}
        onChange={onChange}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
