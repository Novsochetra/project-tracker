import { z } from 'zod';
import { formatTicket } from '../format/ticket';
import { ticketKey } from './fields';
import { ticketImages } from './images';
import { defineTool } from './tool';

export const getTicket = defineTool({
  name: 'get_ticket',
  description:
    'Read one ticket in full: title, key, status, priority, assignee, due date, description, image list, ' +
    'then the whole activity oldest first with author names (events, comments, work reports and reviews ' +
    'with verdict and rating). Up to 4 image attachments are returned as images so you can see screenshots. ' +
    'Read the ticket like this before you work on it or review it.',
  input: z.object({ ticket: ticketKey }),
  readOnly: true,
  async handler(client, { ticket }) {
    const detail = await client.getTicket(ticket);
    return { text: formatTicket(detail), data: detail, images: ticketImages(detail) };
  },
});
