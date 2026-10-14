import type { UserScope } from '../../auth/scope';
import type { RunRow } from '../../db/runTables';
import { isHeld, listQueuedRows, lockChat } from '../../repositories/chatQueue';
import { findChatInScope } from '../../repositories/chats';
import { inTransaction, type ServiceContext } from '../context';
import { notifyRun } from '../runMappers';
import { chatIsBusy } from './queueMessage';
import { startQueuedIn, usableRunner } from './startQueued';

// The oldest message not held by a stopped or failed answer, while the chat is free. One whose
// helper left is passed over, so it can't stall the messages behind it; Send now still moves it.
export async function startWaitingIn(
  trx: ServiceContext,
  scope: UserScope,
  chatId: string,
): Promise<RunRow | null> {
  if (await chatIsBusy(trx.db, scope, chatId)) return null;
  const chat = await findChatInScope(trx.db, scope, chatId, trx.now());
  if (!chat) return null;
  for (const row of await listQueuedRows(trx.db, chatId)) {
    if (isHeld(row)) continue;
    const runner = await usableRunner(trx, scope, chat, row);
    if (runner) return startQueuedIn(trx, scope, chat, { row, runner });
  }
  return null;
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
