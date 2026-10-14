import { splitRunAllCard, type RunAllCardInput, type RunAllResult } from '@tracker/shared';
import type { UserScope } from '../auth/scope';
import { conflict, notFound } from '../errors';
import type { ChatMessageRow } from '../db/chatTables';
import type { Db } from '../db/schema';
import { claimMessageBatch, findMessage, listLaterClaudeTexts } from '../repositories/chats';
import { runAllTodo } from './batchRuns';
import type { CardRef } from './chatTickets';
import { requireChat } from './chats';
import type { ServiceContext } from './context';

const STARTED = 'This card already started its batch.';
const REPLACED = 'A newer Run all card replaced this one.';

// The chat shows an unconfirmed card as replaced once Claude sends a newer one.
const isReplaced = async (db: Db, message: ChatMessageRow): Promise<boolean> =>
  (await listLaterClaudeTexts(db, message)).some(({ text }) => splitRunAllCard(text));

// Run all from a chat's card: the same batch the project's button starts, kept on the card.
export async function runAllFromCard(
  ctx: ServiceContext,
  scope: UserScope,
  ref: CardRef,
  { ticketKeys, ...input }: RunAllCardInput,
): Promise<RunAllResult> {
  const chat = await requireChat(ctx, scope, ref.chatId);
  const message = await findMessage(ctx.db, chat.id, ref.messageId);
  if (message?.role !== 'claude') throw notFound('That answer was not found.');
  if (!splitRunAllCard(message.text)) throw conflict('That answer has no Run all card.');
  if (message.batchRunId) throw conflict(STARTED);
  if (await isReplaced(ctx.db, message)) throw conflict(REPLACED);
  const result = await runAllTodo(ctx, scope, {
    projectKey: chat.projectKey,
    input,
    shown: ticketKeys,
    onQueued: async (trx, batchId) => {
      if (!(await claimMessageBatch(trx, message.id, batchId))) throw conflict(STARTED);
    },
  });
  // A tap that raced the one that started the batch finds its tickets taken, not a batch to hold.
  if (!result.runId && (await findMessage(ctx.db, chat.id, message.id))?.batchRunId) {
    throw conflict(STARTED);
  }
  return result;
}
