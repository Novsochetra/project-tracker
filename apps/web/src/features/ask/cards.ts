import {
  splitTicketCard,
  type CardSplit,
  type CardTicketInput,
  type ChatMessage,
  type TicketCard,
} from '@tracker/shared';

export interface MessageCard {
  split: CardSplit;
  // Claude sent a newer card after this one, and this one never became a ticket.
  replaced: boolean;
}

// Only Claude writes cards; a person's message that quotes one stays text.
export function messageCards(messages: readonly ChatMessage[]): Map<string, MessageCard> {
  const splits = messages.flatMap((message) => {
    const split = message.role === 'claude' ? splitTicketCard(message.text) : null;
    return split ? [{ message, split }] : [];
  });
  const latest = splits.at(-1)?.message.id;
  return new Map(
    splits.map(({ message, split }) => [
      message.id,
      { split, replaced: message.id !== latest && message.ticketKey === null },
    ]),
  );
}

export const cardInput = (card: TicketCard): CardTicketInput => ({
  title: card.title.trim(),
  description: card.description.trim(),
  priority: card.priority,
});

export const canCreate = (card: TicketCard): boolean => card.title.trim().length > 0;
