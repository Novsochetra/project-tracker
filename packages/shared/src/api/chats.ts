import { z } from 'zod';
import { ASK_MODELS, ASK_MODES } from '../domain/askOptions';
import { CHAT_QUESTION_MAX } from '../domain/chat';
import { PRIORITIES } from '../domain/priority';
import { TICKET_DESCRIPTION_MAX, TICKET_TITLE_MAX } from '../domain/ticket';
import { runnerId } from './runs';

export const askInput = z.object({
  runnerId,
  text: z
    .string()
    .trim()
    .min(1, 'Write a question for Claude.')
    .max(CHAT_QUESTION_MAX, `Use at most ${CHAT_QUESTION_MAX} characters for the question.`),
  // Names only: the helper turns each into its own fixed flags.
  model: z.enum(ASK_MODELS).default('default'),
  mode: z.enum(ASK_MODES).default('ask'),
});
export type AskInput = z.input<typeof askInput>;

// The card's fields as the person left them, edits included.
export const cardTicketInput = z.object({
  title: z.string().trim().min(1, 'Add a title to create the ticket.').max(TICKET_TITLE_MAX),
  description: z.string().max(TICKET_DESCRIPTION_MAX).default(''),
  priority: z.enum(PRIORITIES).default('medium'),
});
export type CardTicketInput = z.input<typeof cardTicketInput>;
