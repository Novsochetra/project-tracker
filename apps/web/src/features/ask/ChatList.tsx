import type { Chat } from '@tracker/shared';
import { ListCard } from '../../components';
import { useNow } from '../../lib/useNow';
import { ChatDeleteSheet } from './ChatDeleteSheet';
import { ChatRow } from './ChatRow';
import { useChatDeleteSheet } from './useChatDeleteSheet';

export function ChatList({ chats, projectKey }: { chats: Chat[]; projectKey: string }) {
  const now = useNow();
  const { sheet, show, close } = useChatDeleteSheet();
  return (
    <>
      <ListCard as="section" aria-label="Chats">
        {chats.map((chat, index) => (
          <ChatRow
            key={chat.id}
            chat={chat}
            projectKey={projectKey}
            index={index}
            now={now}
            onSwipeDelete={show}
          />
        ))}
      </ListCard>
      <ChatDeleteSheet projectKey={projectKey} sheet={sheet} onClose={close} />
    </>
  );
}
