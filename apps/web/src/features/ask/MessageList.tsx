import type { ChatMessage, Run, Runner } from '@tracker/shared';
import { useMemo, type ReactNode } from 'react';
import { UsageLine } from '../claude/UsageLine';
import { AnswerSteps } from './AnswerSteps';
import { CardThread } from './CardThread';
import { messageCards, type MessageCards } from './cards';
import styles from './ChatScreen.module.css';
import { ClaudeFrom } from './ClaudeFrom';
import { Markdown } from './markdown/Markdown';
import { MessageText as Text } from './MessageText';
import { StoppedSteps } from './StoppedSteps';
import { threadItems } from './thread';

export interface MessageListProps {
  chatId: string;
  messages: ChatMessage[];
  // The helper a created card's Run starts on.
  helper: Runner | null;
  stoppedRuns?: Run[];
  latestRun?: ReactNode;
}

interface ClaudeMessageProps {
  chatId: string;
  message: ChatMessage;
  cards: MessageCards | undefined;
  helper: Runner | null;
}

function ClaudeMessage({ chatId, message, cards, helper }: ClaudeMessageProps) {
  return (
    <article className={styles.claude} aria-label="Claude">
      <ClaudeFrom />
      {message.runId && message.stepCount > 0 && (
        <AnswerSteps runId={message.runId} count={message.stepCount} answer={message.text} />
      )}
      {cards ? (
        <CardThread chatId={chatId} message={message} cards={cards} helper={helper} />
      ) : (
        <Markdown className={styles.text} text={message.text} />
      )}
      <UsageLine usage={message.usage} />
    </article>
  );
}

export function MessageList({
  chatId,
  messages,
  helper,
  stoppedRuns = [],
  latestRun,
}: MessageListProps) {
  const cards = useMemo(() => messageCards(messages), [messages]);
  const items = useMemo(() => threadItems(messages, stoppedRuns), [messages, stoppedRuns]);
  return (
    <ol className={styles.messages} aria-label="Messages">
      {items.map((item) => {
        if (item.kind === 'stopped') return <StoppedSteps key={item.run.id} run={item.run} />;
        const { message } = item;
        return (
          <li key={message.id} className={`${styles.item} rise`}>
            {message.role === 'person' ? (
              <article className={styles.person} aria-label="You">
                <Text text={message.text} />
              </article>
            ) : (
              <ClaudeMessage
                chatId={chatId}
                message={message}
                cards={cards.get(message.id)}
                helper={helper}
              />
            )}
          </li>
        );
      })}
      {latestRun}
    </ol>
  );
}
