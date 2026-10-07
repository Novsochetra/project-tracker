import { z } from 'zod';
import { formatTicketList } from '../format/tickets';
import { category, projectKey, statusName } from './fields';
import { statusByName } from './statusByName';
import { defineTool } from './tool';

export const listTickets = defineTool({
  name: 'list_tickets',
  description:
    "List a project's tickets, one line each: key · status · priority · title · @assignee · due date. " +
    'Filter by status name, by status category (use category "in_review" to find work waiting for review) ' +
    'or by a search query matched against titles and keys. Use get_ticket to read a ticket in full.',
  input: z.object({
    project: projectKey,
    status: statusName.optional(),
    category: category.optional(),
    query: z
      .string()
      .trim()
      .max(200)
      .optional()
      .describe('Search text matched against ticket titles and keys.'),
  }),
  readOnly: true,
  async handler(client, input) {
    const { statuses } = await client.getProject(input.project);
    const status = input.status === undefined ? undefined : statusByName(statuses, input.status);
    const tickets = await client.listTickets(input.project, {
      status: status?.name,
      category: input.category,
      q: input.query,
    });
    return { text: formatTicketList(tickets, statuses), data: tickets };
  },
});
