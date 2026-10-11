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
      // Keep editing leaves the sheet under it open as the person left it, and Discard changes
      // closes that sheet, which holds the screen itself.
      holdOnClose={false}
    />
  );
}
