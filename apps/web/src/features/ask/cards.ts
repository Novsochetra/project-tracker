import {
  splitTicketCards,
  type CardSegment,
  type CardTicketInput,
  type ChatMessage,
  type TicketCard,
} from '@tracker/shared';

export interface MessageCards {
  segments: CardSegment[];
  // An older answer's cards that never became tickets were replaced by the latest one's.
  latest: boolean;
}

export interface IndexedCard {
  index: number;
  card: TicketCard;
}

const hasCard = (segments: readonly CardSegment[]) =>
  segments.some((segment) => segment.kind === 'card');

// Only Claude writes cards; a person's message that quotes one stays text.
export function messageCards(messages: readonly ChatMessage[]): Map<string, MessageCards> {
  const answers = messages.flatMap((message) => {
    const segments = message.role === 'claude' ? splitTicketCards(message.text) : [];
    return hasCard(segments) ? [{ message, segments }] : [];
  });
  const latest = answers.at(-1)?.message.id;
  return new Map(
    answers.map(({ message, segments }) => [
      message.id,
      { segments, latest: message.id === latest },
    ]),
  );
}

export const cardsOf = (segments: readonly CardSegment[]): TicketCard[] =>
  segments.flatMap((segment) => (segment.kind === 'card' ? [segment.card] : []));

export const cardTicketKey = (message: ChatMessage, index: number): string | null =>
  message.cardTickets.find((link) => link.index === index)?.ticketKey ?? null;

export const pendingCards = (message: ChatMessage, drafts: readonly TicketCard[]): IndexedCard[] =>
  drafts
    .map((card, index) => ({ index, card }))
    .filter(({ index }) => cardTicketKey(message, index) === null);

export const cardInput = ({ index, card }: IndexedCard): CardTicketInput => ({
  title: card.title.trim(),
  description: card.description.trim(),
  priority: card.priority,
  index,
});

export const canCreate = (card: TicketCard): boolean => card.title.trim().length > 0;

// One card has its own Create; Create all is for an answer that split the work.
export const offersCreateAll = (cards: MessageCards, pending: readonly IndexedCard[]): boolean =>
  cards.latest && cardsOf(cards.segments).length > 1 && pending.length > 0;
