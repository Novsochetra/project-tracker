import type { UserScope } from '../../auth/scope';
import type { ChatGitActionRow } from '../../db/chatChangeTables';
import type { ServiceContext } from '../context';

// The helper hears of a queued one for it; the phone reads the chat's changes again.
export function notifyGitAction(
  ctx: ServiceContext,
  userId: UserScope,
  row: ChatGitActionRow,
  projectId: string,
): void {
  ctx.runEvents.publish({
    userId,
    event: {
      type: 'chat-git',
      actionId: row.id,
      runnerId: row.runnerId,
      chatId: row.chatId,
      projectId,
      status: row.status,
    },
  });
}
