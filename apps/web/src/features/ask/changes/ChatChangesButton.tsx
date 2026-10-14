import type { ChatChanges, ChatChangesAnswer, ChatDetail } from '@tracker/shared';
import { FileDiff } from 'lucide-react';
import { useState } from 'react';
import { useChatChanges } from '../../../api/hooks/chatChanges';
import { Button } from '../../../components';
import styles from './ChatChanges.module.css';
import { currentAction } from './actionNote';
import { ChatChangesSheet } from './ChatChangesSheet';
import { CHANGES_LABEL } from './copy';

export interface ChatChangesButtonProps {
  chatId: string;
  chatTitle: string;
}

type Shown = ChatChangesAnswer & { changes: ChatChanges };

// After a commit nothing may be left to change, but the result and Open PR still are.
const shown = (answer: ChatChangesAnswer | undefined): answer is Shown =>
  !!answer?.changes && (answer.changes.files.length > 0 || currentAction(answer) !== null);

export function ChatChangesButton({ chatId, chatTitle }: ChatChangesButtonProps) {
  const { data } = useChatChanges(chatId);
  const [open, setOpen] = useState(false);
  if (!shown(data)) return null;
  return (
    <>
      <Button className={styles.open} icon={FileDiff} onClick={() => setOpen(true)}>
        {CHANGES_LABEL} <span className={styles.count}>{data.changes.files.length}</span>
      </Button>
      <ChatChangesSheet
        open={open}
        onClose={() => setOpen(false)}
        chatId={chatId}
        chatTitle={chatTitle}
        answer={data}
      />
    </>
  );
}

// Before the first question there is no chat to have changes.
export function ChatChangesArea({ detail }: { detail: ChatDetail | null }) {
  if (!detail) return null;
  return <ChatChangesButton chatId={detail.chat.id} chatTitle={detail.chat.title} />;
}
