import clsx from 'clsx';
import { CircleAlert } from 'lucide-react';
import { useEffect } from 'react';
import { errorMessage, isNotFound } from '../../api';
import { useChat } from '../../api/hooks/chats';
import { Button, EmptyState, Spinner } from '../../components';
import { useNavigation } from '../../navigation';
import { ChatLoadingBar } from './AskLoadingBars';
import styles from './ChatScreen.module.css';
import { ChatView } from './ChatView';

export interface ChatScreenProps {
  projectKey: string;
  chatId: string | null;
  ticketNum?: number | undefined;
}

// Another user's chat answers 404 like a deleted one, and both fall back to the chat list.
function useLeaveMissingChat(error: Error | null, projectKey: string): void {
  const { replace } = useNavigation();
  const missing = isNotFound(error);
  useEffect(() => {
    if (missing) replace({ name: 'chats', key: projectKey });
  }, [missing, projectKey, replace]);
}

export function ChatScreen({ projectKey, chatId, ticketNum }: ChatScreenProps) {
  const query = useChat(chatId);
  useLeaveMissingChat(query.error, projectKey);
  if (chatId === null || query.data) {
    const detail = query.data ?? null;
    return (
      <ChatView projectKey={projectKey} chatId={chatId} detail={detail} ticketNum={ticketNum} />
    );
  }
  const failed = query.error !== null && !isNotFound(query.error);
  return (
    <>
      <ChatLoadingBar projectKey={projectKey} chatId={chatId} ticketNum={ticketNum} />
      {failed ? (
        <EmptyState
          icon={CircleAlert}
          title="Couldn't load this chat"
          text={errorMessage(query.error)}
          action={<Button onClick={() => void query.refetch()}>Try again</Button>}
        />
      ) : (
        <div className={clsx(styles.loading, 'quiet-in')}>
          <Spinner label="Loading the chat" />
        </div>
      )}
    </>
  );
}
