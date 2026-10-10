import type { ChatMessage, Run, Runner } from '@tracker/shared';
import { useMemo, type ReactNode } from 'react';
import { LinkedText } from '../ticket/activity/LinkedText';
import { AnswerSteps } from './AnswerSteps';
import { messageCards, type MessageCard } from './cards';
import styles from './ChatScreen.module.css';
import { ClaudeFrom } from './ClaudeFrom';
import { StoppedSteps } from './StoppedSteps';
import { threadItems } from './thread';
import { TicketCardView } from './TicketCardView';

export interface MessageListProps {
  chatId: string;
  messages: ChatMessage[];
  // The helper a created card's Run starts on.
  helper: Runner | null;
  stoppedRuns?: Run[];
  latestRun?: ReactNode;
}

// Rendered as text and links only, as comments are, so nothing Claude writes becomes markup.
function Text({ text }: { text: string }) {
  if (!text) return null;
  return (
    <p className={styles.text}>
      <LinkedText text={text} />
    </p>
  );
}

interface ClaudeMessageProps {
  chatId: string;
  message: ChatMessage;
  card: MessageCard | undefined;
  helper: Runner | null;
}

function ClaudeMessage({ chatId, message, card, helper }: ClaudeMessageProps) {
  return (
    <article className={styles.claude} aria-label="Claude">
      <ClaudeFrom />
      {message.runId && message.stepCount > 0 && (
        <AnswerSteps runId={message.runId} count={message.stepCount} answer={message.text} />
      )}
      {card ? (
        <>
          <Text text={card.split.before} />
          <TicketCardView
            key={message.id}
            chatId={chatId}
            message={message}
            card={card}
            helper={helper}
          />
          <Text text={card.split.after} />
        </>
      ) : (
        <Text text={message.text} />
      )}
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
                card={cards.get(message.id)}
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
