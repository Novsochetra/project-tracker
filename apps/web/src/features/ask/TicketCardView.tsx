import type { Runner, TicketCard } from '@tracker/shared';
import { Ticket } from 'lucide-react';
import { Icon } from '../../components';
import { CardEditor, type CardEditorProps } from './CardEditor';
import { CreatedCard } from './CreatedCard';
import styles from './TicketCard.module.css';

export interface TicketCardViewProps extends CardEditorProps {
  card: TicketCard;
  ticketKey: string | null;
  replaced: boolean;
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

export function TicketCardView({
  card,
  ticketKey,
  replaced,
  helper,
  ...editor
}: TicketCardViewProps) {
  if (ticketKey) return <CreatedCard ticketKey={ticketKey} card={card} helper={helper} />;
  if (replaced) return <ReplacedCard title={card.title} />;
  return <CardEditor {...editor} />;
}
