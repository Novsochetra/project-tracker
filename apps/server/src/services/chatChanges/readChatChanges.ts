import type { ChatChangesAnswer } from '@tracker/shared';
import type { UserScope } from '../../auth/scope';
import { findChatChanges } from '../../repositories/chatChanges';
import { latestGitAction } from '../../repositories/gitActions';
import { requireChat } from '../chats';
import type { ServiceContext } from '../context';
import { toChatChanges, toGitAction } from './chatChangesRows';
import { expireGitAction } from './expireGitAction';

export async function readChatChanges(
  ctx: ServiceContext,
  scope: UserScope,
  chatId: string,
): Promise<ChatChangesAnswer> {
  const chat = await requireChat(ctx, scope, chatId);
  await expireGitAction(ctx, scope, chat);
  const [changes, action] = await Promise.all([
    findChatChanges(ctx.db, chat.id),
    latestGitAction(ctx.db, chat.id),
  ]);
  return {
    changes: changes ? toChatChanges(changes) : null,
    action: action ? toGitAction(action) : null,
  };
}
