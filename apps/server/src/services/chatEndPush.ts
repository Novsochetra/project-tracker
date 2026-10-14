import {
  chatAnsweredPush,
  chatFailedPush,
  projectDisplayName,
  type PushChat,
} from '@tracker/shared';
import type { UserScope } from '../auth/scope';
import { findChatInScope, type ChatWithKey } from '../repositories/chats';
import type { RunWithKey } from '../repositories/runs';
import type { ServiceContext } from './context';
import { pushToUser } from './push';

export const pushChatOf = (chat: ChatWithKey): PushChat => ({
  projectKey: chat.projectKey,
  // A lock screen is a screen too.
  projectName: projectDisplayName({
    name: chat.projectName,
    key: chat.projectKey,
    hideName: chat.projectHideName === 1,
  }),
  chatId: chat.id,
  title: chat.title,
});

// A cancel is the person's own doing. Read after the answer is saved, so the push names the chat
// as it is now.
export function pushChatEnd(ctx: ServiceContext, scope: UserScope, run: RunWithKey): void {
  const { chatId, status } = run;
  if (!chatId || (status !== 'done' && status !== 'failed')) return;
  pushToUser(ctx, scope, async () => {
    const chat = await findChatInScope(ctx.db, scope, chatId, ctx.now());
    if (!chat) return null;
    return status === 'done'
      ? chatAnsweredPush(pushChatOf(chat))
      : chatFailedPush(pushChatOf(chat));
  });
}
