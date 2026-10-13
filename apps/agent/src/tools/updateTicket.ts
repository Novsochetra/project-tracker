import { parseTicketKey, TICKET_ASSIGNEE_MAX, type UpdateTicketInput } from '@tracker/shared';
import type { TrackerApi } from '../client';
import { z } from 'zod';
import { ToolError } from '../errors';
import { description, labelNames, priority, ticketKey, title } from './fields';
import { labelsByName } from './labelsByName';
import { defineTool } from './tool';

async function labelIds(client: TrackerApi, ticket: string, names: string[]): Promise<string[]> {
  const project = await client.getProject(parseTicketKey(ticket)?.projectKey ?? '');
  return labelsByName(project.labels, names).map((label) => label.id);
}

export const updateTicket = defineTool({
  name: 'update_ticket',
  description:
    "Edit a ticket's title, description, priority, assignee, due date or labels. Only the fields you pass change; " +
    'pass an empty string to clear the assignee or the due date. Returns which fields changed. ' +
    'To change the status use move_ticket, or the claim, submit and review tools for the normal workflow.',
  input: z.object({
    ticket: ticketKey,
    title: title.optional().describe('New title.'),
    description: description.optional().describe('New description. Plain text.'),
    priority: priority.optional(),
    assignee: z
      .string()
      .trim()
      .max(TICKET_ASSIGNEE_MAX)
      .optional()
      .describe('Assignee name, or an empty string to unassign.'),
    due: z
      .string()
      .trim()
      .regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Use a due date like 2026-10-09, or an empty string.')
      .optional()
      .describe('Due date as YYYY-MM-DD, or an empty string to clear it.'),
    labels: labelNames
      .optional()
      .describe('The whole set of label names the ticket gets, or [] to remove them all.'),
  }),
  readOnly: false,
  async handler(client, { ticket, labels, ...fields }) {
    const changed = Object.entries(fields)
      .filter(([, value]) => value !== undefined)
      .map(([name]) => name)
      .concat(labels === undefined ? [] : ['labels']);
    if (changed.length === 0) {
      throw new ToolError(
        'Nothing to update. Pass at least one of: title, description, priority, assignee, due, labels.',
      );
    }
    const input: UpdateTicketInput =
      labels === undefined
        ? fields
        : { ...fields, labelIds: await labelIds(client, ticket, labels) };
    const updated = await client.updateTicket(ticket, input);
    return { text: `Updated ${updated.key}: ${changed.join(', ')}.`, data: updated };
  },
});
