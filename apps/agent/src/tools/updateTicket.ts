import { z } from 'zod';
import { ToolError } from '../errors';
import { priority, ticketKey, title } from './fields';
import { defineTool } from './tool';

export const updateTicket = defineTool({
  name: 'update_ticket',
  description:
    "Edit a ticket's title, description, priority, assignee or due date. Only the fields you pass change; " +
    'pass an empty string to clear the assignee or the due date. Returns which fields changed. ' +
    'To change the status use move_ticket, or the claim, submit and review tools for the normal workflow.',
  input: z.object({
    ticket: ticketKey,
    title: title.optional().describe('New title.'),
    description: z.string().max(50_000).optional().describe('New description. Plain text.'),
    priority: priority.optional(),
    assignee: z
      .string()
      .trim()
      .max(80)
      .optional()
      .describe('Assignee name, or an empty string to unassign.'),
    due: z
      .string()
      .trim()
      .regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Use a due date like 2026-10-09, or an empty string.')
      .optional()
      .describe('Due date as YYYY-MM-DD, or an empty string to clear it.'),
  }),
  readOnly: false,
  async handler(client, { ticket, ...fields }) {
    const changed = Object.entries(fields)
      .filter(([, value]) => value !== undefined)
      .map(([name]) => name);
    if (changed.length === 0) {
      throw new ToolError(
        'Nothing to update. Pass at least one of: title, description, priority, assignee, due.',
      );
    }
    const updated = await client.updateTicket(ticket, fields);
    return { text: `Updated ${updated.key}: ${changed.join(', ')}.`, data: updated };
  },
});
