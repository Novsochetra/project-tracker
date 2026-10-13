import { labelNames, labelsOf, type Label } from '@tracker/shared';
import { Tag } from 'lucide-react';
import { useRef, useState } from 'react';
import { Icon, PropertyRow } from '../../components';
import { LabelMenu } from './LabelMenu';

export interface LabelsRowProps {
  labels: readonly Label[];
  value: readonly string[];
  onChange: (labelIds: string[]) => void;
}

export function LabelsRow({ labels, value, onChange }: LabelsRowProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const names = labelNames(labelsOf(labels, value));
  return (
    <>
      <PropertyRow
        ref={triggerRef}
        icon={<Icon icon={Tag} />}
        label="Labels"
        value={names || 'None'}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((isOpen) => !isOpen)}
      />
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
