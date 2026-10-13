import { z } from 'zod';
import { formatTicketLine, statusNameOf } from '../format/tickets';
import {
  description,
  newTicketLabelNames,
  priority,
  projectKey,
  statusName,
  title,
} from './fields';
import { labelsByName } from './labelsByName';
import { statusByName } from './statusByName';
import { defineTool } from './tool';

export const createTicket = defineTool({
  name: 'create_ticket',
  description:
    'Create a ticket in a project and return its key and summary line. Without a status it goes to the ' +
    "project's To do status; priority defaults to medium. Use it to record follow-up work or bugs you find " +
    'instead of doing unrequested work. Write a clear title and put details and acceptance criteria in the description. ' +
    "Labels are names of the project's labels (a Bug label for a bug, for example).",
  input: z.object({
    project: projectKey,
    title: title.describe('Short, specific title.'),
    description: description
      .optional()
      .describe('Details, steps to reproduce or acceptance criteria. Plain text.'),
    priority: priority.optional(),
    status: statusName.optional(),
    labels: newTicketLabelNames.optional(),
  }),
  readOnly: false,
  async handler(client, input) {
    const { statuses, labels } = await client.getProject(input.project);
    const status = input.status === undefined ? undefined : statusByName(statuses, input.status);
    const picked = input.labels === undefined ? [] : labelsByName(labels, input.labels);
    const ticket = await client.createTicket(input.project, {
      title: input.title,
      description: input.description,
      priority: input.priority,
      statusId: status?.id,
      ...(picked.length > 0 ? { labelIds: picked.map((label) => label.id) } : {}),
    });
    const line = formatTicketLine(ticket, statusNameOf(statuses, ticket.statusId), labels);
    return { text: `Created ${line}`, data: ticket };
  },
});
