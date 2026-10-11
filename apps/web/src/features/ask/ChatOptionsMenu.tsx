import { Ellipsis, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { IconButton, MenuConfirm, MenuItem, Popover } from '../../components';
import { CHAT_OPTIONS_LABEL, DELETE_CHAT_LABEL, DELETE_CHAT_QUESTION } from './copy';
import { useChatDelete } from './useChatDelete';

export function ChatOptionsMenu({ projectKey, chatId }: { projectKey: string; chatId: string }) {
  const remove = useChatDelete(projectKey, chatId);
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
  return (
    <Popover
      open={open}
      onClose={close}
      aria-label={CHAT_OPTIONS_LABEL}
      trigger={
        <IconButton
          ref={triggerRef}
          aria-label={CHAT_OPTIONS_LABEL}
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
          onConfirm={() => remove.deleteChat(close)}
        />
      ) : (
        <MenuItem icon={Trash2} tone="danger" onClick={() => setConfirming(true)}>
          {DELETE_CHAT_LABEL}
        </MenuItem>
      )}
    </Popover>
  );
}
