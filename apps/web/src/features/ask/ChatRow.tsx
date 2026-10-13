import { formatRelative, type Chat } from '@tracker/shared';
import clsx from 'clsx';
import { ChevronRight, Trash2 } from 'lucide-react';
import { Icon, ListRow } from '../../components';
import { SwipeActions, type SwipeAction } from '../../gestures';
import { useIsPhone } from '../../lib/media';
import { useIsOpening, useNavigation } from '../../navigation';
import { riseDelay } from '../projects/projectRows';
import { WaitingMark } from '../requests/WaitingMark';
import { ChatOptionsMenu } from './ChatOptionsMenu';
import styles from './ChatsScreen.module.css';
import { chatOptionsLabel, DELETE_LABEL } from './copy';
import { focusNeighbourRow } from './focusNeighbourRow';

export interface ChatRowProps {
  chat: Chat;
  projectKey: string;
  index: number;
  now: number;
  onSwipeDelete: (chat: Chat) => void;
}

const deleteAction = (onTrigger: () => void): SwipeAction => ({
  label: DELETE_LABEL,
  icon: <Icon icon={Trash2} size={20} />,
  tone: 'danger',
  onTrigger,
});

function ChatRowMain({ chat, projectKey, now }: Pick<ChatRowProps, 'chat' | 'projectKey' | 'now'>) {
  const { push } = useNavigation();
  const route = { name: 'chat', key: projectKey, chatId: chat.id } as const;
  const opening = useIsOpening(route);
  return (
    <ListRow className={styles.row} data-opening={opening || undefined} onClick={() => push(route)}>
      <span className={styles.chatTitle}>{chat.title}</span>{' '}
      {chat.waiting ? (
        <WaitingMark />
      ) : (
        <span className={styles.time}>{formatRelative(chat.updatedAt, now)}</span>
      )}
      <Icon icon={ChevronRight} size={20} className={styles.chevron} />
    </ListRow>
  );
}

export function ChatRow({ chat, projectKey, index, now, onSwipeDelete }: ChatRowProps) {
  const isPhone = useIsPhone();
  const main = <ChatRowMain chat={chat} projectKey={projectKey} now={now} />;
  return (
    <div
      className={clsx(styles.item, 'rise')}
      style={{ animationDelay: `${riseDelay(index)}ms` }}
      data-chat-row={chat.id}
    >
      {isPhone ? (
        <SwipeActions className={styles.swipe} trailing={[deleteAction(() => onSwipeDelete(chat))]}>
          {main}
        </SwipeActions>
      ) : (
        <>
          {main}
          <ChatOptionsMenu
            projectKey={projectKey}
            chatId={chat.id}
            label={chatOptionsLabel(chat.title)}
            onDeleted={() => focusNeighbourRow(chat.id)}
            className={styles.options}
          />
        </>
      )}
    </div>
  );
}
