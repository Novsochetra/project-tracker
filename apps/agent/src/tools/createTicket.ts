import { z } from 'zod';
import { formatTicketLine, statusNameOf } from '../format/tickets';
import { priority, projectKey, statusName, title } from './fields';
import { statusByName } from './statusByName';
import { defineTool } from './tool';

export const createTicket = defineTool({
  name: 'create_ticket',
  description:
    'Create a ticket in a project and return its key and summary line. Without a status it goes to the ' +
    "project's To do status; priority defaults to medium. Use it to record follow-up work or bugs you find " +
    'instead of doing unrequested work. Write a clear title and put details and acceptance criteria in the description.',
  input: z.object({
    project: projectKey,
    title: title.describe('Short, specific title.'),
    description: z
      .string()
      .max(50_000)
      .optional()
      .describe('Details, steps to reproduce or acceptance criteria. Plain text.'),
    priority: priority.optional(),
    status: statusName.optional(),
  }),
  readOnly: false,
  async handler(client, input) {
    const { statuses } = await client.getProject(input.project);
    const status = input.status === undefined ? undefined : statusByName(statuses, input.status);
    const ticket = await client.createTicket(input.project, {
      title: input.title,
      description: input.description,
      priority: input.priority,
      statusId: status?.id,
    });
    const line = formatTicketLine(ticket, statusNameOf(statuses, ticket.statusId));
    return { text: `Created ${line}`, data: ticket };
  },
});
