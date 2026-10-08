import { REPORT_TEXT_MAX } from '@tracker/shared';
import { z } from 'zod';
import { formatVerdict } from '../format/activity';
import { rating, ticketKey, verdict } from './fields';
import { defineTool } from './tool';

export const reviewTicket = defineTool({
  name: 'review_ticket',
  description:
    'Record your review of a ticket in Need review: a verdict, a 1-5 rating and a summary. "approved" moves it ' +
    'to Reviewed, where a person checks it and moves it to Done. "changes_requested" moves it to the top of ' +
    'To do so a worker picks it up next; the summary must then say specifically what to fix. Rating: 5 fully ' +
    'meets the requirement with good quality and tests; 4 meets it with minor nits; 3 works but has notable ' +
    'issues; 2 partially meets it; 1 does not meet it. Approve only when the requirement is fully met and ' +
    'your own verification passed.',
  input: z.object({
    ticket: ticketKey,
    verdict,
    rating: rating.describe('1 to 5, see the rubric.'),
    summary: z
      .string()
      .trim()
      .min(1, 'Write a review summary.')
      .max(REPORT_TEXT_MAX)
      .describe('What you checked and found; for changes_requested, specific actionable feedback.'),
  }),
  readOnly: false,
  async handler(client, { ticket, ...review }) {
    const detail = await client.reviewTicket(ticket, review);
    const verdictText = formatVerdict(review);
    return {
      text: `Reviewed ${detail.ticket.key}: ${verdictText}. It is now in ${detail.status.name}.`,
      data: detail,
    };
  },
});
