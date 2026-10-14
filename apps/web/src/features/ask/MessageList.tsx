import type { ChatMessage, Run, Runner } from '@tracker/shared';
import { useMemo, type ReactNode } from 'react';
import { UsageLine } from '../claude/UsageLine';
import { AnswerTodos } from '../todos/AnswerTodos';
import { AnswerSteps } from './AnswerSteps';
import { AnswerText } from './AnswerText';
import { CardThread } from './CardThread';
import { messageCards, type MessageCards } from './cards';
import { messageRunAllCards, type RunAllMessageCard } from './runAllCard';
import { RunAllCardView } from './RunAllCardView';
import styles from './ChatScreen.module.css';
import { ClaudeFrom } from './ClaudeFrom';
import { MessageText as Text } from './MessageText';
import { MessageAttachments } from './messageFiles/MessageAttachments';
import { StoppedSteps } from './StoppedSteps';
import { threadItems } from './thread';

export interface MessageListProps {
  chatId: string;
  projectKey: string;
  messages: ChatMessage[];
  // The helper a created card's Run starts on.
  helper: Runner | null;
  stoppedRuns?: Run[];
  latestRun?: ReactNode;
}

interface ClaudeMessageProps {
  chatId: string;
  projectKey: string;
  message: ChatMessage;
  cards: MessageCards | undefined;
  runAll: RunAllMessageCard | undefined;
  helper: Runner | null;
}

function MessageBody({ chatId, projectKey, message, cards, runAll, helper }: ClaudeMessageProps) {
  if (runAll) {
    return (
      <>
        <AnswerText text={runAll.split.before} />
        <RunAllCardView
          key={message.id}
          chatId={chatId}
          projectKey={projectKey}
          message={message}
          card={runAll}
          helper={helper}
        />
        <AnswerText text={runAll.split.after} />
      </>
    );
  }
  return cards ? (
    <CardThread chatId={chatId} message={message} cards={cards} helper={helper} />
  ) : (
    <AnswerText text={message.text} />
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
      {message.todos && <AnswerTodos todos={message.todos} />}
      <MessageBody {...props} />
      <MessageAttachments attachments={message.attachments} from="claude" />
      <UsageLine usage={message.usage} />
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
              <article className={styles.personMessage} aria-label="You">
                <MessageAttachments attachments={message.attachments} from="person" />
                <div className={styles.person}>
                  <Text text={message.text} />
                </div>
              </article>
            ) : (
              <ClaudeMessage
                chatId={chatId}
                projectKey={projectKey}
                message={message}
                cards={cards.get(message.id)}
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
