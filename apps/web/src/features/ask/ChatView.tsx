import type { ChatDetail } from '@tracker/shared';
import { ASK_LABEL, NEW_CHAT_LABEL } from '../../app/crumbs';
import { NavBar, NavBarSpacer } from '../../navigation';
import { savedAskOptions } from './askOptions';
import { ChatFooterArea } from './ChatFooterArea';
import styles from './ChatScreen.module.css';
import { ASK_INTRO } from './copy';
import { LatestRunSteps } from './LatestRunSteps';
import { MessageList } from './MessageList';
import { useAskHelper } from './useAskHelper';
import { useScrollToEnd } from './useScrollToEnd';
import { useWorkingSteps } from './useWorkingSteps';

export interface ChatViewProps {
  projectKey: string;
  chatId: string | null;
  detail: ChatDetail | null;
}

export function ChatView({ projectKey, chatId, detail }: ChatViewProps) {
  const helper = useAskHelper(projectKey, detail?.run);
  const messages = detail?.messages ?? [];
  useScrollToEnd(`${messages.length}:${helper.footer.kind}`);
  const { threadRef, rows: workingSteps } = useWorkingSteps(detail?.run);
  return (
    <div className={styles.screen}>
      <NavBar
        title={detail?.chat.title ?? NEW_CHAT_LABEL}
        backLabel={ASK_LABEL}
        right={<NavBarSpacer />}
      />
      <div ref={threadRef} className={styles.thread}>
        {messages.length === 0 ? (
          <p className={styles.intro}>{ASK_INTRO}</p>
        ) : (
          <MessageList
            chatId={chatId ?? ''}
            messages={messages}
            helper={helper.cardHelper}
            latestRun={<LatestRunSteps run={detail?.run} working={workingSteps} />}
          />
        )}
      </div>
      <ChatFooterArea
        projectKey={projectKey}
        chatId={chatId}
        helper={helper}
        savedOptions={savedAskOptions(detail?.chat)}
      />
    </div>
  );
}
