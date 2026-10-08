import { ActionSheet } from './ActionSheet';

export interface DiscardChangesSheetProps {
  open: boolean;
  onKeep: () => void;
  onDiscard: () => void;
}

export function DiscardChangesSheet({ open, onKeep, onDiscard }: DiscardChangesSheetProps) {
  return (
    <ActionSheet
      open={open}
      onClose={onKeep}
      label="Discard changes?"
      caption="Discard changes?"
      actions={[{ label: 'Discard changes', tone: 'danger', onSelect: onDiscard }]}
      cancelLabel="Keep editing"
    />
  );
}
