import { z } from 'zod';
import { claimedReply } from './claimed';
import { ticketKey } from './fields';
import { defineTool } from './tool';

export const claimTicket = defineTool({
  name: 'claim_ticket',
  description:
    'Claim a specific ticket to work on: moves it to In progress and returns it in full like get_ticket, with ' +
    'images. Use it when the user names the ticket; otherwise use claim_next_ticket.',
  input: z.object({ ticket: ticketKey }),
  readOnly: false,
  async handler(client, { ticket }) {
    return claimedReply(await client.claimTicket(ticket));
  },
});
