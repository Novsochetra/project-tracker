import { randomUUID } from 'node:crypto';
import type { ServiceContext } from './context';
import { insertMessage, updateChatRow } from '../repositories/chats';

export const planNotStartedText = (reason: string): string =>
  `Couldn't start the approved plan: ${reason}`;

// The card already says the plan was approved, so the chat says why nothing carries it out.
export async function sayPlanNotStarted(
  ctx: ServiceContext,
  chatId: string,
  reason: string,
): Promise<void> {
  const at = ctx.now();
  await insertMessage(ctx.db, {
    id: randomUUID(),
    chatId,
    role: 'claude',
    text: planNotStartedText(reason),
    ticketId: null,
    runId: null,
    batchRunId: null,
    createdAt: at,
  });
  await updateChatRow(ctx.db, chatId, { updatedAt: at });
}
