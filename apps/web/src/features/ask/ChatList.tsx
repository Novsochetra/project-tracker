import { formatRelative, type Chat } from '@tracker/shared';
import { ChevronRight, MessageCircleQuestion } from 'lucide-react';
import { Icon, ListCard, ListRow } from '../../components';
import { useNow } from '../../lib/useNow';
import { useIsOpening, useNavigation } from '../../navigation';
import { riseDelay } from '../projects/projectRows';
import { WAITING_ROW_TEXT } from '../requests/copy';
import styles from './ChatsScreen.module.css';

interface ChatRowProps {
  chat: Chat;
  projectKey: string;
  index: number;
  now: number;
}

function ChatRow({ chat, projectKey, index, now }: ChatRowProps) {
  const { push } = useNavigation();
  const route = { name: 'chat', key: projectKey, chatId: chat.id } as const;
  const opening = useIsOpening(route);
  return (
    <ListRow
      className={`${styles.row} rise`}
      style={{ animationDelay: `${riseDelay(index)}ms` }}
      data-opening={opening || undefined}
      onClick={() => push(route)}
    >
      <span className={styles.chatTitle}>{chat.title}</span>{' '}
      {chat.waiting ? (
        <span className={styles.waiting}>
          <Icon icon={MessageCircleQuestion} size={14} />
          {WAITING_ROW_TEXT}
        </span>
      ) : (
        <span className={styles.time}>{formatRelative(chat.updatedAt, now)}</span>
      )}
      <Icon icon={ChevronRight} size={20} className={styles.chevron} />
    </ListRow>
  );
}

export function ChatList({ chats, projectKey }: { chats: Chat[]; projectKey: string }) {
  const now = useNow();
  return (
    <ListCard as="section" aria-label="Chats">
      {chats.map((chat, index) => (
        <ChatRow key={chat.id} chat={chat} projectKey={projectKey} index={index} now={now} />
      ))}
    </ListCard>
  );
}
