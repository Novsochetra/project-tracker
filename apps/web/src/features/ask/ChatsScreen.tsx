import { CircleAlert, MessageCircle, SquarePen } from 'lucide-react';
import { useEffect } from 'react';
import { errorMessage, isNotFound, useProject } from '../../api';
import { useChats } from '../../api/hooks/chats';
import { ASK_LABEL, NEW_CHAT_LABEL } from '../../app/crumbs';
import { Button, EmptyState, Spinner } from '../../components';
import { BottomBar, NavBar, NavBarSpacer, useNavigation, useScreen } from '../../navigation';
import { ChatList } from './ChatList';
import styles from './ChatsScreen.module.css';
import { ASK_INTRO } from './copy';

function useNewChat(projectKey: string): () => void {
  const { push } = useNavigation();
  return () => push({ name: 'chat', key: projectKey, chatId: null });
}

// A project deleted elsewhere has no chats left to show.
function useLeaveMissingProject(error: Error | null, projectKey: string): void {
  const { isTop } = useScreen();
  const { replace } = useNavigation();
  const missing = isNotFound(error);
  useEffect(() => {
    if (missing && isTop) replace({ name: 'project', key: projectKey });
  }, [missing, isTop, replace, projectKey]);
}

function ChatsBody({ projectKey }: { projectKey: string }) {
  const chats = useChats(projectKey);
  useLeaveMissingProject(chats.error, projectKey);
  if (chats.data && chats.data.length > 0) {
    return (
      <div className={styles.content}>
        <ChatList chats={chats.data} projectKey={projectKey} />
      </div>
    );
  }
  // No New chat of its own: it is already in the header on desktop and the bottom bar on phones.
  if (chats.data) {
    return <EmptyState fill icon={MessageCircle} title="No chats yet" text={ASK_INTRO} />;
  }
  if (chats.error && !isNotFound(chats.error)) {
    return (
      <EmptyState
        icon={CircleAlert}
        title="Couldn't load the chats"
        text={errorMessage(chats.error)}
        action={<Button onClick={() => void chats.refetch()}>Try again</Button>}
      />
    );
  }
  return (
    <div className={`${styles.loading} quiet-in`}>
      <Spinner label="Loading the chats" />
    </div>
  );
}

export function ChatsScreen({ projectKey }: { projectKey: string }) {
  const project = useProject(projectKey).data?.project;
  const newChat = useNewChat(projectKey);
  return (
    <>
      <NavBar
        title={ASK_LABEL}
        backLabel={project?.name ?? projectKey.toUpperCase()}
        right={<NavBarSpacer />}
      />
      <div className={styles.page}>
        <ChatsBody projectKey={projectKey} />
      </div>
      <BottomBar>
        <Button variant="primary" size="bar" icon={SquarePen} fullWidth onClick={newChat}>
          {NEW_CHAT_LABEL}
        </Button>
      </BottomBar>
    </>
  );
}
