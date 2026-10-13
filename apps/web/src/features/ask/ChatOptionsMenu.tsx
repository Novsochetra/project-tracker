import { Ellipsis, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { IconButton, MenuConfirm, MenuItem, Popover } from '../../components';
import { CHAT_OPTIONS_LABEL, DELETE_CHAT_LABEL, DELETE_CHAT_QUESTION } from './copy';
import { useChatDelete } from './useChatDelete';

export interface ChatOptionsMenuProps {
  projectKey: string;
  chatId: string;
  label?: string;
  // In the chat list: stay on the list and hand focus on, since the row goes.
  onDeleted?: (() => void) | undefined;
  className?: string | undefined;
}

export function ChatOptionsMenu({
  projectKey,
  chatId,
  label = CHAT_OPTIONS_LABEL,
  onDeleted,
  className,
}: ChatOptionsMenuProps) {
  const remove = useChatDelete(projectKey, chatId, !onDeleted);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const close = () => setOpen(false);
  // The item that had focus disappears with the menu, so focus goes back to the ••• button.
  const dismiss = () => {
    close();
    triggerRef.current?.focus();
  };
  const toggle = () => {
    setConfirming(false);
    remove.reset();
    setOpen(!open);
  };
  const deleted = () => {
    close();
    onDeleted?.();
  };
  return (
    <Popover
      open={open}
      onClose={close}
      aria-label={label}
      className={className}
      trigger={
        <IconButton
          ref={triggerRef}
          aria-label={label}
          aria-expanded={open}
          icon={Ellipsis}
          onClick={toggle}
        />
      }
    >
      {confirming ? (
        <MenuConfirm
          message={remove.error ?? DELETE_CHAT_QUESTION}
          pending={remove.pending}
          onCancel={dismiss}
          onConfirm={() => remove.deleteChat(deleted)}
        />
      ) : (
        <MenuItem icon={Trash2} tone="danger" onClick={() => setConfirming(true)}>
          {DELETE_CHAT_LABEL}
        </MenuItem>
      )}
    </Popover>
  );
}
