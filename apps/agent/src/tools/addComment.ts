import { COMMENT_TEXT_MAX } from '@tracker/shared';
import { z } from 'zod';
import { ticketKey } from './fields';
import { defineTool } from './tool';

export const addComment = defineTool({
  name: 'add_comment',
  description:
    'Add a comment to a ticket. Use it while you work to record important decisions, assumptions, questions ' +
    'and blockers, so the person and other agents can follow along. Plain text.',
  input: z.object({
    ticket: ticketKey,
    text: z
      .string()
      .trim()
      .min(1, 'Write the comment text.')
      .max(COMMENT_TEXT_MAX)
      .describe('The comment.'),
  }),
  readOnly: false,
  async handler(client, { ticket, text }) {
    const comment = await client.addComment(ticket, { text });
    return { text: `Added a comment to ${ticket}.`, data: comment };
  },
});
