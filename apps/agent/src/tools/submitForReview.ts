import { z } from 'zod';
import { ticketKey } from './fields';
import { defineTool } from './tool';

export const submitForReview = defineTool({
  name: 'submit_for_review',
  description:
    'Submit your finished work on a ticket for review. Stores a report on the ticket (summary, files, next ' +
    'steps) and moves it to Need review, where a reviewer picks it up. Call it only after you verified the ' +
    'work (tests, build). If you are blocked, use add_comment instead and leave the ticket In progress.',
  input: z.object({
    ticket: ticketKey,
    summary: z
      .string()
      .trim()
      .min(1, 'Write a summary of the work.')
      .max(20_000)
      .describe('What you changed and why, and how you verified it.'),
    files: z
      .string()
      .max(20_000)
      .optional()
      .describe('Files you created or edited, one per line or comma separated.'),
    next: z
      .string()
      .max(20_000)
      .optional()
      .describe('Anything the person still needs to do or decide, or "none".'),
  }),
  readOnly: false,
  async handler(client, { ticket, summary, files, next }) {
    const detail = await client.submitForReview(ticket, { summary, files, next });
    return {
      text: `Submitted ${detail.ticket.key} for review. It is now in ${detail.status.name}.`,
      data: detail,
    };
  },
});
