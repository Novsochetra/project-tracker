import { labelNames, labelsOf, type Label } from '@tracker/shared';
import { Tag } from 'lucide-react';
import { useRef, useState } from 'react';
import { Icon, PropertyRow } from '../../components';
import { LabelPopup } from './LabelPopup';

export interface LabelsRowProps {
  projectKey: string;
  labels: readonly Label[];
  value: readonly string[];
  subtitle?: string | undefined;
  manageable?: boolean;
  onChange: (labelIds: string[]) => void;
}

export function LabelsRow({
  projectKey,
  labels,
  value,
  subtitle,
  manageable,
  onChange,
}: LabelsRowProps) {
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
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((isOpen) => !isOpen)}
      />
      <LabelPopup
        open={open}
        anchorRef={triggerRef}
        projectKey={projectKey}
        subtitle={subtitle}
        manageable={manageable}
        labels={labels}
        value={value}
        onChange={onChange}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
