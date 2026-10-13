import type { CardTicketLink, ChatRole } from '../domain/chat';
import { ticketCards } from './ticketCard';

export interface AskHistoryMessage {
  role: ChatRole;
  text: string;
  cardTickets?: readonly CardTicketLink[];
  files?: readonly string[];
}

// Numbered from 1, as the person counts the cards on screen.
export const cardMark = ({ index, ticketKey }: CardTicketLink): string =>
  `[card ${index + 1} → ${ticketKey}]`;

// Claude's own words don't say which cards the person made into tickets, so it would send them
// again with a change.
export const markedText = ({ text, cardTickets = [] }: AskHistoryMessage): string =>
  [text, ...cardTickets.map(cardMark)].join('\n');

// A resumed session has Claude's answers but not the marks, so they come with the card's title.
export const madeCardLines = (history: readonly AskHistoryMessage[]): string[] =>
  history.flatMap(({ text, cardTickets = [] }) => {
    const cards = ticketCards(text);
    return cardTickets.map((link) => `${cardMark(link)} ${cards[link.index]?.title ?? ''}`.trim());
  });
