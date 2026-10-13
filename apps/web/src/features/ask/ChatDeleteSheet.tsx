import { useEffect } from 'react';
import { ActionSheet } from '../../overlays';
import styles from './ChatScreen.module.css';
import { DELETE_CHAT_LABEL, DELETE_CHAT_QUESTION } from './copy';
import { useChatDelete } from './useChatDelete';
import type { ChatDeleteSheetState } from './useChatDeleteSheet';

export interface ChatDeleteSheetProps {
  projectKey: string;
  sheet: ChatDeleteSheetState | null;
  onClose: () => void;
}

export function ChatDeleteSheet({ projectKey, sheet, onClose }: ChatDeleteSheetProps) {
  const chatId = sheet?.chat.id ?? '';
  const open = sheet?.open ?? false;
  const remove = useChatDelete(projectKey, chatId, false);
  const { reset } = remove;
  // A failed delete of the last swipe must not show on the next one.
  useEffect(() => {
    if (open) reset();
  }, [open, chatId, reset]);
  const caption = remove.error ? (
    <span role="alert" className={styles.confirm}>
      {remove.error}
    </span>
  ) : (
    DELETE_CHAT_QUESTION
  );
  return (
    <ActionSheet
      open={open}
      onClose={onClose}
      label={DELETE_CHAT_LABEL}
      caption={caption}
      actions={[
        {
          label: DELETE_CHAT_LABEL,
          tone: 'danger',
          bold: true,
          onSelect: () => remove.deleteChat(onClose),
        },
      ]}
    />
  );
}
