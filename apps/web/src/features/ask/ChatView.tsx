import { useMemo } from 'react';
import type { ChatDetail } from '@tracker/shared';
import { NEW_CHAT_LABEL } from '../../app/crumbs';
import { NavBar, NavBarSpacer } from '../../navigation';
import { savedAskOptions } from './askOptions';
import { ChatFooterArea } from './ChatFooterArea';
import { ChatOptionsSheet } from './ChatOptionsSheet';
import styles from './ChatScreen.module.css';
import { ChatTicketLink } from './ChatTicketLink';
import { stoppedRunsOf } from './thread';
import { chatBackLabel, chatIntro } from './ticketChat';
import { MessageList } from './MessageList';
import { useAskHelper } from './useAskHelper';
import { useScrollToEnd } from './useScrollToEnd';
import { useWorkingMessage } from './useWorkingMessage';
import { WorkingMessage } from './WorkingMessage';

export interface ChatViewProps {
  projectKey: string;
  chatId: string | null;
  detail: ChatDetail | null;
  // The ticket the screen was opened from, whose screen Back returns to.
  ticketNum?: number | undefined;
}

export function ChatView({ projectKey, chatId, detail, ticketNum }: ChatViewProps) {
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
        backLabel={chatBackLabel(projectKey, ticketNum)}
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
        <ChatTicketLink projectKey={projectKey} detail={detail} ticketNum={ticketNum} />
        {messages.length === 0 ? (
          <p className={styles.intro}>{chatIntro(ticketNum)}</p>
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
