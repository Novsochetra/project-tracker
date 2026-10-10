import type { ChatMessage, Runner } from '@tracker/shared';
import { Ticket } from 'lucide-react';
import { Icon } from '../../components';
import type { MessageCard } from './cards';
import { CardEditor } from './CardEditor';
import { CreatedCard } from './CreatedCard';
import styles from './TicketCard.module.css';

export interface TicketCardViewProps {
  chatId: string;
  message: ChatMessage;
  card: MessageCard;
  helper: Runner | null;
}

function ReplacedCard({ title }: { title: string }) {
  return (
    <section className={styles.replaced} aria-label="Replaced ticket card">
      <Icon icon={Ticket} size={14} />
      <span className={styles.replacedTitle}>{title}</span>
      <span className={styles.replacedNote}>Replaced</span>
    </section>
  );
}

export function TicketCardView({ chatId, message, card, helper }: TicketCardViewProps) {
  if (message.ticketKey) {
    return <CreatedCard ticketKey={message.ticketKey} card={card.split.card} helper={helper} />;
  }
  if (card.replaced) return <ReplacedCard title={card.split.card.title} />;
  return <CardEditor chatId={chatId} messageId={message.id} card={card.split.card} />;
}
