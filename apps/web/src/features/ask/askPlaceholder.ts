import type { ChatDetail } from '@tracker/shared';
import { ASK_PLACEHOLDER, ASK_TICKET_PLACEHOLDER } from './copy';

// A loaded chat is about its own ticket; a new one about the ticket its screen was opened from.
export function askPlaceholder(detail: ChatDetail | null, ticketNum: number | undefined): string {
  const aboutTicket = detail ? detail.chat.ticket !== null : ticketNum !== undefined;
  return aboutTicket ? ASK_TICKET_PLACEHOLDER : ASK_PLACEHOLDER;
}
