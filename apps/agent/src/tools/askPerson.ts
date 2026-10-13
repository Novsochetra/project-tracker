import { QUESTION_CHOICE_MAX, QUESTION_CHOICES_MAX, QUESTION_TEXT_MAX } from '@tracker/shared';
import { z } from 'zod';
import type { TrackerApi } from '../client';
import { QUESTION_LIMIT_MS, replyText } from './askPersonReply';
import { ticketKey } from './fields';
import { pollUntilEnded } from './pollUntilEnded';
import { defineTool } from './tool';

// The tracker ends the question at its deadline; this is for a tracker that can't be reached then.
const LOCAL_LIMIT_MS = QUESTION_LIMIT_MS + 60_000;
const CANCEL_TIMEOUT_MS = 10_000;

// So the phone never shows a question nobody waits for. A tracker that can't take it ends the
// question itself at the deadline.
async function endOnTracker(client: TrackerApi, id: string): Promise<void> {
  try {
    await client.cancelQuestion(id, { signal: AbortSignal.timeout(CANCEL_TIMEOUT_MS) });
  } catch {
    return;
  }
}

export const askPerson = defineTool({
  name: 'ask_person',
  description:
    'Ask the person a question on a ticket and wait for their answer from their phone, up to 30 minutes. ' +
    'Use it when a decision only the person can make blocks the work, instead of guessing. Give choices ' +
    'when the answer is one of a few options; the person can also write their own answer. Returns the ' +
    'answer, or tells you to go on with your best judgment when nobody answers.',
  input: z.object({
    ticket: ticketKey,
    question: z
      .string()
      .trim()
      .min(1, 'Write the question.')
      .max(QUESTION_TEXT_MAX)
      .describe('The question, short and plain.'),
    choices: z
      .array(z.string().trim().min(1).max(QUESTION_CHOICE_MAX))
      .max(QUESTION_CHOICES_MAX)
      .optional()
      .describe(
        `Up to ${QUESTION_CHOICES_MAX} short answers to pick from, each shown as a button.`,
      ),
  }),
  readOnly: false,
  async handler(client, { ticket, question, choices }, call) {
    const signal = call?.signal ?? new AbortController().signal;
    const asked = await client.askQuestion(ticket, { question, choices });
    const end = await pollUntilEnded({
      waitOnce: (each) => client.waitForQuestion(asked.id, { signal: each }),
      isOpen: (seen) => seen.status === 'open',
      limitMs: LOCAL_LIMIT_MS,
      signal,
    });
    if (end.kind !== 'ended') await endOnTracker(client, asked.id);
    return { text: replyText(end), data: end.kind === 'ended' ? end.value : asked };
  },
});
