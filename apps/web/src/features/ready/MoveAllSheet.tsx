import { useRef, useState } from 'react';
import { ActionSheet } from '../../overlays';
import { moveAllLabel, moveAllQuestion, type DoneBatch } from './doneBatch';
import type { MoveAllProps } from './MoveAllToDone';
import { MoveAllTrigger } from './MoveAllTrigger';
import { useMoveAllToDone } from './useMoveAllToDone';

// Asked in an action sheet. The tickets leave once the sheet has, as the card holding the sheet
// may leave with them.
export function MoveAllSheet({ batch, compact, onMove, className }: MoveAllProps) {
  const moveAll = useMoveAllToDone();
  const [open, setOpen] = useState(false);
  const chosen = useRef<DoneBatch | null>(null);
  const close = () => setOpen(false);
  const onClosed = () => {
    const confirmed = chosen.current;
    chosen.current = null;
    if (confirmed) onMove(moveAll(confirmed));
  };

  const confirm = {
    label: moveAllLabel(batch),
    bold: true,
    onSelect: () => {
      chosen.current = batch;
      close();
    },
  };

  return (
    <>
      <MoveAllTrigger
        batch={batch}
        look={compact ? 'icon' : 'row'}
        expanded={open}
        className={className}
        onClick={() => setOpen(true)}
      />
      <ActionSheet
        open={open}
        onClose={close}
        onClosed={onClosed}
        label="Move to Done"
        caption={moveAllQuestion(batch)}
        actions={[confirm]}
      />
    </>
  );
}
