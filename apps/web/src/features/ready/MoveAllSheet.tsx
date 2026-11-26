import clsx from 'clsx';
import { CheckCheck } from 'lucide-react';
import { useRef, useState } from 'react';
import { Icon } from '../../components';
import { ActionSheet } from '../../overlays';
import { moveAllLabel, moveAllQuestion, type DoneBatch } from './doneBatch';
import type { MoveAllProps } from './MoveAllToDone';
import { useMoveAllToDone } from './useMoveAllToDone';
import styles from './MoveAllToDone.module.css';

// Asked in an action sheet. The tickets leave once the sheet has, as the card holding the sheet
// may leave with them.
export function MoveAllSheet({ batch, onMove, className }: MoveAllProps) {
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
      <button
        type="button"
        className={clsx('ring-inside', styles.row, className)}
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Icon icon={CheckCheck} />
        {moveAllLabel(batch)}
      </button>
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
