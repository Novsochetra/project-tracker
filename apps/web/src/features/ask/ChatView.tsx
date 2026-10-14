import { useMemo } from 'react';
import type { ChatDetail } from '@tracker/shared';
import { NEW_CHAT_LABEL } from '../../app/crumbs';
import { NavBar, NavBarSpacer } from '../../navigation';
import { savedAskOptions } from './askOptions';
import { askPlaceholder } from './askPlaceholder';
import { ChatChangesArea } from './changes/ChatChangesButton';
import { ChatFooterArea } from './ChatFooterArea';
import { ChatOptionsSheet } from './ChatOptionsSheet';
import styles from './ChatScreen.module.css';
import { ChatTicketLink } from './ChatTicketLink';
import { DoIt } from './DoIt';
import { stoppedRunsOf } from './thread';
import { chatBackLabel, chatIntro } from './ticketChat';
import { MessageList } from './MessageList';
import { useAskHelper } from './useAskHelper';
import { useScrollToEnd } from './useScrollToEnd';
import { ThreadEnd } from './ThreadEnd';
import { useWorkingMessage } from './useWorkingMessage';

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
  useScrollToEnd(`${messages.length}:${detail?.queued?.length ?? 0}:${helper.footer.kind}`);
  const { threadRef, ...live } = useWorkingMessage(detail?.run);
  const stoppedRuns = useMemo(() => stoppedRunsOf(detail), [detail]);
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
            projectKey={projectKey}
            messages={messages}
            helper={helper.cardHelper}
            stoppedRuns={stoppedRuns}
            latestRun={
              <ThreadEnd
                chatId={chatId ?? ''}
                detail={detail}
                live={live}
                waits={helper.footer.kind === 'thinking'}
              />
            }
          />
        )}
        <DoIt projectKey={projectKey} detail={detail} />
        <ChatChangesArea detail={detail} />
      </div>
      <ChatFooterArea
        projectKey={projectKey}
        chatId={chatId}
        helper={helper}
        waiting={live.requests.waiting}
        savedOptions={savedAskOptions(detail?.chat)}
        placeholder={askPlaceholder(detail, ticketNum)}
        detail={detail}
      />
    </div>
  );
}
