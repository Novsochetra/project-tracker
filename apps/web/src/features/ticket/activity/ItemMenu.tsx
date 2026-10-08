import { Ellipsis, PenLine, Trash2 } from 'lucide-react';
import { useRef, useState, type ReactNode, type RefObject } from 'react';
import { ConfirmCard, IconButton, MenuItem, Popover } from '../../../components';
import { DURATION } from '../../../design/motion';
import { useIsPhone, usePrefersReducedMotion } from '../../../lib/media';
import { ActionSheet, type ActionSheetAction } from '../../../overlays';

export interface ItemMenuProps {
  /** What the item is called in the labels: "comment", "report", "review". */
  noun: string;
  onEdit?: (() => void) | undefined;
  onDelete: () => void;
  /** Hides the button (while editing) but lets an open sheet finish its exit. */
  hidden?: boolean;
  triggerRef?: RefObject<HTMLButtonElement | null>;
}

interface MenuState {
  open: boolean;
  confirming: boolean;
  close: () => void;
  confirm: () => void;
  cancel: () => void;
}

const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const deleteMessage = (noun: string) => `Delete this ${noun}? This can't be undone.`;

export function ItemMenu({ hidden = false, triggerRef, ...props }: ItemMenuProps) {
  const isPhone = useIsPhone();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const ownRef = useRef<HTMLButtonElement>(null);
  const ref = triggerRef ?? ownRef;
  const state: MenuState = {
    open,
    confirming,
    close: () => setOpen(false),
    confirm: () => setConfirming(true),
    cancel: () => {
      setOpen(false);
      ref.current?.focus({ preventScroll: true });
    },
  };
  const trigger = (
    <IconButton
      ref={ref}
      aria-label={`${capitalized(props.noun)} options`}
      aria-expanded={open}
      icon={Ellipsis}
      size="sm"
      onClick={(event) => {
        // Safari doesn't focus a tapped button; the sheet hands focus back to what had it.
        event.currentTarget.focus({ preventScroll: true });
        // Reset here rather than on close, so a closing sheet doesn't flip back mid-animation.
        setConfirming(false);
        setOpen(!open);
      }}
    />
  );
  if (isPhone) {
    return (
      <>
        {!hidden && trigger}
        <ItemSheet {...props} {...state} />
      </>
    );
  }
  return hidden ? null : <ItemPopover {...props} {...state} trigger={trigger} />;
}

function ItemPopover({
  noun,
  onEdit,
  onDelete,
  open,
  confirming,
  close,
  confirm,
  cancel,
  trigger,
}: ItemMenuProps & MenuState & { trigger: ReactNode }) {
  const run = (action: () => void) => () => {
    close();
    action();
  };
  return (
    <Popover
      open={open}
      onClose={close}
      aria-label={`${capitalized(noun)} options`}
      trigger={trigger}
    >
      {confirming ? (
        <ConfirmCard
          variant="menu"
          message={deleteMessage(noun)}
          onCancel={cancel}
          onConfirm={run(onDelete)}
        />
      ) : (
        <>
          {onEdit && (
            <MenuItem icon={PenLine} onClick={run(onEdit)}>
              Edit {noun}
            </MenuItem>
          )}
          <MenuItem icon={Trash2} tone="danger" onClick={confirm}>
            Delete {noun}
          </MenuItem>
        </>
      )}
    </Popover>
  );
}

function ItemSheet({
  noun,
  onEdit,
  onDelete,
  open,
  confirming,
  close,
  confirm,
}: ItemMenuProps & MenuState) {
  const reducedMotion = usePrefersReducedMotion();
  const run = (action: () => void) => () => {
    close();
    action();
  };
  // The sheet belongs to the card being deleted; removing the card first would cut its exit short.
  const deleteAfterExit = () => {
    close();
    setTimeout(onDelete, reducedMotion ? 0 : DURATION.sheetOut);
  };
  const actions: ActionSheetAction[] = confirming
    ? [{ label: 'Delete', tone: 'danger', bold: true, onSelect: deleteAfterExit }]
    : [
        ...(onEdit ? [{ label: `Edit ${noun}`, onSelect: run(onEdit) }] : []),
        { label: `Delete ${noun}`, tone: 'danger', onSelect: confirm },
      ];
  return (
    <ActionSheet
      open={open}
      onClose={close}
      label={`${capitalized(noun)} options`}
      caption={confirming ? deleteMessage(noun) : undefined}
      actions={actions}
    />
  );
}
