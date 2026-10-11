import { Ellipsis } from 'lucide-react';
import { useState } from 'react';
import { Icon } from '../../components';
import { NavBarButton } from '../../navigation';
import { ActionSheet, type ActionSheetAction } from '../../overlays';
import styles from './ChatScreen.module.css';
import { CHAT_OPTIONS_LABEL, DELETE_CHAT_LABEL, DELETE_CHAT_QUESTION } from './copy';
import { useChatDelete } from './useChatDelete';

export interface ChatOptionsSheetProps {
  projectKey: string;
  chatId: string;
  title: string;
}

export function ChatOptionsSheet({ projectKey, chatId, title }: ChatOptionsSheetProps) {
  const remove = useChatDelete(projectKey, chatId);
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const close = () => setOpen(false);
  const show = () => {
    setConfirming(false);
    remove.reset();
    setOpen(true);
  };
  const action: ActionSheetAction = confirming
    ? {
        label: DELETE_CHAT_LABEL,
        tone: 'danger',
        bold: true,
        onSelect: () => remove.deleteChat(close),
      }
    : { label: DELETE_CHAT_LABEL, tone: 'danger', onSelect: () => setConfirming(true) };
  const caption = confirming ? (
    <span role="alert" className={styles.confirm}>
      {remove.error ?? DELETE_CHAT_QUESTION}
    </span>
  ) : (
    title
  );
  return (
    <>
      <NavBarButton aria-label={CHAT_OPTIONS_LABEL} onClick={show}>
        <Icon icon={Ellipsis} size={20} />
      </NavBarButton>
      <ActionSheet
        open={open}
        onClose={close}
        label={CHAT_OPTIONS_LABEL}
        caption={caption}
        actions={[action]}
      />
    </>
  );
}
