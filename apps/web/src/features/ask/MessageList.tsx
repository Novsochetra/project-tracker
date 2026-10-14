import type { ChatMessage, Run, Runner } from '@tracker/shared';
import { useMemo, type ReactNode } from 'react';
import { LinkedText } from '../ticket/activity/LinkedText';
import { AnswerSteps } from './AnswerSteps';
import { messageCards, type MessageCard } from './cards';
import { messageRunAllCards, type RunAllMessageCard } from './runAllCard';
import { RunAllCardView } from './RunAllCardView';
import styles from './ChatScreen.module.css';
import { ClaudeFrom } from './ClaudeFrom';
import { StoppedSteps } from './StoppedSteps';
import { threadItems } from './thread';
import { TicketCardView } from './TicketCardView';

export interface MessageListProps {
  chatId: string;
  projectKey: string;
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
  projectKey: string;
  message: ChatMessage;
  card: MessageCard | undefined;
  runAll: RunAllMessageCard | undefined;
  helper: Runner | null;
}

function MessageBody({ chatId, projectKey, message, card, runAll, helper }: ClaudeMessageProps) {
  if (runAll) {
    return (
      <>
        <Text text={runAll.split.before} />
        <RunAllCardView
          key={message.id}
          chatId={chatId}
          projectKey={projectKey}
          message={message}
          card={runAll}
          helper={helper}
        />
        <Text text={runAll.split.after} />
      </>
    );
  }
  if (!card) return <Text text={message.text} />;
  return (
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
  );
}

function ClaudeMessage(props: ClaudeMessageProps) {
  const { message } = props;
  return (
    <article className={styles.claude} aria-label="Claude">
      <ClaudeFrom />
      {message.runId && message.stepCount > 0 && (
        <AnswerSteps runId={message.runId} count={message.stepCount} answer={message.text} />
      )}
      <MessageBody {...props} />
    </article>
  );
}

export function MessageList({
  chatId,
  projectKey,
  messages,
  helper,
  stoppedRuns = [],
  latestRun,
}: MessageListProps) {
  const cards = useMemo(() => messageCards(messages), [messages]);
  const runAllCards = useMemo(() => messageRunAllCards(messages), [messages]);
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
                projectKey={projectKey}
                message={message}
                card={cards.get(message.id)}
                runAll={runAllCards.get(message.id)}
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
