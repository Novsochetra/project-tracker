import { z } from 'zod';
import { ASK_EFFORTS, ASK_MODELS, ASK_MODES } from '../domain/askOptions';
import { CHAT_QUESTION_MAX } from '../domain/chat';
import { PRIORITIES } from '../domain/priority';
import { TICKET_DESCRIPTION_MAX, TICKET_TITLE_MAX } from '../domain/ticket';
import { MAX_NEW_ATTACHMENTS, tooManyFilesMessage } from '../domain/attachment';
import { runnerId } from './runs';

const questionText = z
  .string()
  .trim()
  .min(1, 'Write a question for Claude.')
  .max(CHAT_QUESTION_MAX, `Use at most ${CHAT_QUESTION_MAX} characters for the question.`);

export const askInput = z.object({
  runnerId,
  text: questionText,
  // Names only: the helper turns each into its own fixed flags. No default, since a missing one
  // keeps the chat's saved choice (chosenAskOptions).
  model: z.enum(ASK_MODELS).optional(),
  mode: z.enum(ASK_MODES).optional(),
  effort: z.enum(ASK_EFFORTS).optional(),
  attachmentIds: z
    .array(z.string().min(1).max(64))
    .max(MAX_NEW_ATTACHMENTS, tooManyFilesMessage('question'))
    .default([]),
});
export type AskInput = z.input<typeof askInput>;

export const queuedEditInput = z.object({ text: questionText });
export type QueuedEditInput = z.input<typeof queuedEditInput>;

// A chat started from a ticket screen is about that ticket for good.
export const startChatInput = askInput.extend({
  ticketKey: z.string().trim().min(1).max(40).optional(),
});
export type StartChatInput = z.input<typeof startChatInput>;

// The card's fields as the person left them, edits included.
export const cardTicketInput = z.object({
  title: z.string().trim().min(1, 'Add a title to create the ticket.').max(TICKET_TITLE_MAX),
  description: z.string().max(TICKET_DESCRIPTION_MAX).default(''),
  priority: z.enum(PRIORITIES).default('medium'),
  // An older page sends none for its only card.
  index: z.number().int().min(0).default(0),
});
export type CardTicketInput = z.input<typeof cardTicketInput>;
