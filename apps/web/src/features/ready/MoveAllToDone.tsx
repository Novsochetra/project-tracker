import clsx from 'clsx';
import { CheckCheck } from 'lucide-react';
import { useRef, useState, type Ref } from 'react';
import { Icon, MenuConfirm, Popover } from '../../components';
import { holdPresses } from '../../lib/holdPresses';
import { useIsPhone } from '../../lib/media';
import { ActionSheet } from '../../overlays';
import { moveAllLabel, moveAllQuestion, type DoneBatch } from './doneBatch';
import styles from './MoveAllToDone.module.css';
import { useMoveAllToDone } from './useMoveAllToDone';

export interface MoveAllToDoneProps {
  batch: DoneBatch;
  // What places it in a header: on a phone it is the button's, on a desktop the menu's anchor's.
  className?: string | undefined;
}

interface TriggerProps extends MoveAllToDoneProps {
  open: boolean;
  onClick: () => void;
  ref?: Ref<HTMLButtonElement>;
}

function Trigger({ batch, open, onClick, className, ref }: TriggerProps) {
  return (
    <button
      ref={ref}
      type="button"
      className={clsx(styles.button, className)}
      aria-expanded={open}
      onClick={onClick}
    >
      <Icon icon={CheckCheck} />
      {moveAllLabel(batch)}
    </button>
  );
}

// The tickets leave once the sheet has, as the card holding the sheet may leave with them.
function MoveAllSheet({ batch, className }: MoveAllToDoneProps) {
  const moveAll = useMoveAllToDone();
  const [open, setOpen] = useState(false);
  const chosen = useRef<DoneBatch | null>(null);
  const close = () => setOpen(false);
  const onClosed = () => {
    const confirmed = chosen.current;
    chosen.current = null;
    if (confirmed) moveAll(confirmed);
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
      <Trigger batch={batch} open={open} onClick={() => setOpen(true)} className={className} />
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

// The menu leaves with the card when every ticket goes, so the page holds a double-click's second
// click itself, which would land on what moves up into the card's place.
function MoveAllMenu({ batch, className }: MoveAllToDoneProps) {
  const moveAll = useMoveAllToDone();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  // The confirm's buttons leave with it, so focus goes back to the button that asked.
  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const confirm = () => {
    holdPresses(document.body);
    close();
    moveAll(batch);
  };

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      aria-label="Move to Done"
      className={className}
      trigger={
        <Trigger ref={triggerRef} batch={batch} open={open} onClick={() => setOpen(!open)} />
      }
    >
      <MenuConfirm
        message={moveAllQuestion(batch)}
        confirmLabel={`Move to ${batch.doneName}`}
        confirmVariant="primary"
        onCancel={close}
        onConfirm={confirm}
      />
    </Popover>
  );
}

// Asked in an action sheet on a phone and in a menu on a desktop, as deleting a project is.
export function MoveAllToDone(props: MoveAllToDoneProps) {
  return useIsPhone() ? <MoveAllSheet {...props} /> : <MoveAllMenu {...props} />;
}
