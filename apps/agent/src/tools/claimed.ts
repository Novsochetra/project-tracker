import type { TicketDetail } from '@tracker/shared';
import type { TrackerApi } from '../client';
import { ticketReply } from './ticketReply';
import type { ToolReply } from './tool';

export const claimedReply = (client: TrackerApi, detail: TicketDetail): Promise<ToolReply> =>
  ticketReply(client, detail, `Claimed ${detail.ticket.key}. It is now in ${detail.status.name}.`);
