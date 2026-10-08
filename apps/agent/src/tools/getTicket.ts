import { z } from 'zod';
import { MAX_TEXT_CHARS, TEXT_BUDGET_CHARS } from '../format/attachments';
import { ticketKey } from './fields';
import { ticketReply } from './ticketReply';
import { defineTool } from './tool';

const thousands = (count: number): string => count.toLocaleString('en-US');

export const getTicket = defineTool({
  name: 'get_ticket',
  description:
    'Read one ticket in full: title, key, status, priority, assignee, due date, description, attachments, ' +
    'then the whole activity oldest first with author names (events, comments, work reports and reviews ' +
    'with verdict and rating). Up to 4 image attachments are returned as images so you can see screenshots. ' +
    `Text files (txt, log, md, csv, json) are shown inline, up to ${thousands(MAX_TEXT_CHARS)} ` +
    `characters each and ${thousands(TEXT_BUDGET_CHARS)} in all. Videos and PDFs, and text that was cut or ` +
    'left out, are listed with a download URL; when the tracker uses an access token, downloads need it as ' +
    '"Authorization: Bearer <token>". Read the ticket like this before you work on it or review it.',
  input: z.object({ ticket: ticketKey }),
  readOnly: true,
  async handler(client, { ticket }) {
    return ticketReply(client, await client.getTicket(ticket));
  },
});
