import { useMemo } from 'react';
import type { ChatDetail } from '@tracker/shared';
import { ASK_LABEL, NEW_CHAT_LABEL } from '../../app/crumbs';
import { NavBar, NavBarSpacer } from '../../navigation';
import { savedAskOptions } from './askOptions';
import { ChatFooterArea } from './ChatFooterArea';
import { ChatOptionsSheet } from './ChatOptionsSheet';
import styles from './ChatScreen.module.css';
import { ASK_INTRO } from './copy';
import { stoppedRunsOf } from './thread';
import { MessageList } from './MessageList';
import { useAskHelper } from './useAskHelper';
import { useScrollToEnd } from './useScrollToEnd';
import { useWorkingMessage } from './useWorkingMessage';
import { WorkingMessage } from './WorkingMessage';

export interface ChatViewProps {
  projectKey: string;
  chatId: string | null;
  detail: ChatDetail | null;
}

export function ChatView({ projectKey, chatId, detail }: ChatViewProps) {
  const helper = useAskHelper(projectKey, detail?.run);
  const messages = detail?.messages ?? [];
  useScrollToEnd(`${messages.length}:${helper.footer.kind}`);
  const { threadRef, rows, requests } = useWorkingMessage(detail?.run);
  const stoppedRuns = useMemo(() => stoppedRunsOf(detail), [detail]);
  // A request that comes before any step shows the working message too.
  const working = rows.length > 0 || requests.shown.length > 0;
  return (
    <div className={styles.screen}>
      <NavBar
        title={detail?.chat.title ?? NEW_CHAT_LABEL}
        backLabel={ASK_LABEL}
        right={
          detail ? (
            <ChatOptionsSheet
              projectKey={projectKey}
              chatId={detail.chat.id}
              title={detail.chat.title}
            />
          ) : (
            <NavBarSpacer />
          )
        }
      />
      <div ref={threadRef} className={styles.thread}>
        {messages.length === 0 ? (
          <p className={styles.intro}>{ASK_INTRO}</p>
        ) : (
          <MessageList
            chatId={chatId ?? ''}
            messages={messages}
            helper={helper.cardHelper}
            stoppedRuns={stoppedRuns}
            latestRun={
              detail?.run &&
              working && <WorkingMessage runId={detail.run.id} rows={rows} requests={requests} />
            }
          />
        )}
      </div>
      <ChatFooterArea
        projectKey={projectKey}
        chatId={chatId}
        helper={helper}
        waiting={requests.waiting}
        savedOptions={savedAskOptions(detail?.chat)}
      />
    </div>
  );
}
