import type { ChatMessage, Runner } from '@tracker/shared';
import { useMemo } from 'react';
import { AgentAvatar } from '../../components';
import { LinkedText } from '../ticket/activity/LinkedText';
import { messageCards, type MessageCard } from './cards';
import { helperOf, type ChatFooter } from './chatFooter';
import styles from './ChatScreen.module.css';
import { TicketCardView } from './TicketCardView';

export interface MessageListProps {
  chatId: string;
  messages: ChatMessage[];
  footer: ChatFooter;
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
      <div className={styles.from}>
        <AgentAvatar />
        <span>Claude</span>
      </div>
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

export function MessageList({ chatId, messages, footer }: MessageListProps) {
  const cards = useMemo(() => messageCards(messages), [messages]);
  const helper = helperOf(footer);
  return (
    <ol className={styles.messages} aria-label="Messages">
      {messages.map((message) => (
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
      ))}
    </ol>
  );
}
