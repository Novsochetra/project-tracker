import type { UserScope } from '../../auth/scope';
import type { RunRow } from '../../db/runTables';
import { isHeld, listQueuedRows, lockChat } from '../../repositories/chatQueue';
import { findChatInScope } from '../../repositories/chats';
import { inTransaction, type ServiceContext } from '../context';
import { notifyRun } from '../runMappers';
import { chatIsBusy } from './queueMessage';
import { startQueuedIn, usableRunner } from './startQueued';

// The oldest message not held by a stopped or failed answer, while the chat is free.
export async function startWaitingIn(
  trx: ServiceContext,
  scope: UserScope,
  chatId: string,
): Promise<RunRow | null> {
  if (await chatIsBusy(trx.db, scope, chatId)) return null;
  const chat = await findChatInScope(trx.db, scope, chatId, trx.now());
  const row = chat && (await listQueuedRows(trx.db, chatId)).find((queued) => !isHeld(queued));
  const runner = chat && row ? await usableRunner(trx, scope, chat, row) : null;
  return chat && row && runner ? startQueuedIn(trx, scope, chat, { row, runner }) : null;
}

export async function startNextQueued(
  ctx: ServiceContext,
  scope: UserScope,
  chatId: string,
): Promise<void> {
  const run = await inTransaction(ctx, async (db) => {
    await lockChat(db, chatId);
    return startWaitingIn({ ...ctx, db }, scope, chatId);
  });
  if (run) notifyRun(ctx, scope, run);
}
