import type { TicketDetail } from '@tracker/shared';
import { formatTicket } from '../format/ticket';
import { ticketImages } from './images';
import type { ToolReply } from './tool';

export const claimedReply = (detail: TicketDetail): ToolReply => ({
  text: `Claimed ${detail.ticket.key}. It is now in ${detail.status.name}.\n\n${formatTicket(detail)}`,
  data: detail,
  images: ticketImages(detail),
});
