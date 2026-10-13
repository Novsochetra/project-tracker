import { ACTIVE_RUN_STATUSES } from '@tracker/shared';
import type { UserScope } from '../auth/scope';
import { AppError } from '../errors';
import { storageKeysOfChats } from '../repositories/chatAttachments';
import { deleteChatRow } from '../repositories/chats';
import { latestChatRunRow } from '../repositories/runs';
import { requireChat } from './chats';
import { removeFiles } from '../storage/fileStorage';
import { inTransaction, type ServiceContext } from './context';
import { cancelRun } from './runs';

const isActive = (status: string) => ACTIVE_RUN_STATUSES.some((active) => active === status);

// Cancelling first sends the helper the event that stops its Claude; deleting the run alone
// would leave Claude answering a chat that is gone.
async function cancelAnswer(ctx: ServiceContext, scope: UserScope, chatId: string) {
  const run = await latestChatRunRow(ctx.db, scope, chatId);
  if (run && isActive(run.status)) await cancelRun(ctx, scope, run.id).catch(unlessEnded);
}

// The helper may end the answer between the read and the cancel; that run needs no cancel.
function unlessEnded(error: unknown) {
  if (!(error instanceof AppError && error.code === 'conflict')) throw error;
}

// Tickets made from the chat's cards stay; only their link to the message goes.
export async function deleteChat(ctx: ServiceContext, scope: UserScope, id: string) {
  const chat = await requireChat(ctx, scope, id);
  await cancelAnswer(ctx, scope, chat.id);
  const files = await inTransaction(ctx, async (trx) => {
    const keys = await storageKeysOfChats(trx, 'id', chat.id);
    await deleteChatRow(trx, chat.id);
    return keys;
  });
  await removeFiles(ctx.storage, files);
  const event = { type: 'chat-deleted' as const, chatId: chat.id, projectId: chat.projectId };
  ctx.runEvents.publish({ userId: scope, event });
}
