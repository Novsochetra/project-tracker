import { CheckCheck } from 'lucide-react';
import { useRef, useState } from 'react';
import { Icon, MenuConfirm, Popover } from '../../components';
import { holdPresses } from '../../lib/holdPresses';
import { moveAllLabel, moveAllQuestion } from './doneBatch';
import type { MoveAllProps } from './MoveAllToDone';
import { useMoveAllToDone } from './useMoveAllToDone';
import styles from './MoveAllToDone.module.css';

// Asked in a menu, as deleting a project is. The menu can leave with the card when every ticket
// goes, so the page holds a double-click's second click itself, which would land on what moves up
// into the card's place.
export function MoveAllMenu({ batch, onMove, className }: MoveAllProps) {
  const moveAll = useMoveAllToDone();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const cancel = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const confirm = () => {
    holdPresses(document.body);
    setOpen(false);
    onMove(moveAll(batch));
  };

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      aria-label="Move to Done"
      className={className}
      trigger={
        <button
          ref={triggerRef}
          type="button"
          className={styles.button}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <Icon icon={CheckCheck} />
          {moveAllLabel(batch)}
        </button>
      }
    >
      <MenuConfirm
        message={moveAllQuestion(batch)}
        confirmLabel={`Move to ${batch.doneName}`}
        confirmVariant="primary"
        onCancel={cancel}
        onConfirm={confirm}
      />
    </Popover>
  );
}
