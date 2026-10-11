import { ACTIVE_RUN_STATUSES } from '@tracker/shared';
import type { UserScope } from '../auth/scope';
import { deleteChatRow } from '../repositories/chats';
import { latestChatRunRow } from '../repositories/runs';
import { requireChat } from './chats';
import type { ServiceContext } from './context';
import { cancelRun } from './runs';

const isActive = (status: string) => ACTIVE_RUN_STATUSES.some((active) => active === status);

// Cancelling first sends the helper the event that stops its Claude; deleting the run alone
// would leave Claude answering a chat that is gone.
async function cancelAnswer(ctx: ServiceContext, scope: UserScope, chatId: string) {
  const run = await latestChatRunRow(ctx.db, scope, chatId);
  if (run && isActive(run.status)) await cancelRun(ctx, scope, run.id);
}

// Tickets made from the chat's cards stay; only their link to the message goes.
export async function deleteChat(ctx: ServiceContext, scope: UserScope, id: string) {
  const chat = await requireChat(ctx, scope, id);
  await cancelAnswer(ctx, scope, chat.id);
  await deleteChatRow(ctx.db, chat.id);
}
