import { isDoneCategory } from '@tracker/shared';
import { z } from 'zod';
import { ToolError } from '../errors';
import { statusName, ticketKey } from './fields';
import { statusByName } from './statusByName';
import { defineTool } from './tool';

export const moveTicket = defineTool({
  name: 'move_ticket',
  description:
    'Move a ticket to another status by name (case-insensitive, e.g. "In progress"); it goes to the top of that ' +
    'status. Agents cannot move tickets to a Done status: only a person does that. For the normal workflow ' +
    'prefer claim_ticket, submit_for_review and review_ticket, which also record reports and reviews.',
  input: z.object({ ticket: ticketKey, status: statusName }),
  readOnly: false,
  async handler(client, input) {
    const detail = await client.getTicket(input.ticket);
    const target = statusByName(detail.statuses, input.status);
    // The server refuses this too; checking here keeps the rule whichever route the server guards.
    if (isDoneCategory(target.category)) {
      throw new ToolError(
        `Only a person can move a ticket to ${target.name}. When the work is finished, use submit_for_review.`,
      );
    }
    if (target.id === detail.ticket.statusId) {
      return { text: `${detail.ticket.key} is already in ${target.name}.`, data: detail.ticket };
    }
    const ticket = await client.updateTicket(detail.ticket.key, { statusId: target.id });
    return { text: `Moved ${ticket.key} to ${target.name}.`, data: ticket };
  },
});
