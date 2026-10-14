import type { FinishGitActionInput } from '@tracker/shared';
import type { UserScope } from '../../auth/scope';
import { conflict, forbidden, notFound } from '../../errors';
import { saveChatChanges } from '../../repositories/chatChanges';
import { endGitAction, findGitAction } from '../../repositories/gitActions';
import { findChatInScope } from '../../repositories/chats';
import type { ServiceContext } from '../context';
import { notifyGitAction } from './gitActionEvents';

type Changes = NonNullable<FinishGitActionInput['changes']>;

async function saveLeft(
  ctx: ServiceContext,
  ids: { chatId: string; version: string; runnerId: string },
  changes: Changes,
) {
  await saveChatChanges(ctx.db, {
    ...ids,
    tree: changes.tree,
    diff: changes.diff,
    cut: changes.cut ? 1 : 0,
    files: JSON.stringify(changes.files),
    branch: changes.branch,
    defaultBranch: changes.defaultBranch,
    ghReady: changes.ghReady ? 1 : 0,
    createdAt: ctx.now(),
  });
}

export async function finishGitAction(
  ctx: ServiceContext,
  scope: UserScope,
  id: string,
  input: FinishGitActionInput,
): Promise<void> {
  const action = await findGitAction(ctx.db, id);
  const chat = action && (await findChatInScope(ctx.db, scope, action.chatId, ctx.now()));
  if (!action || !chat) throw notFound('That commit or pull request was not found.');
  if (action.runnerId !== input.runnerId) {
    throw forbidden('Only the helper that took it says how it ended.');
  }
  const ending = {
    status: input.status,
    error: input.status === 'failed' ? (input.error ?? 'It failed.') : null,
    result: input.result ? JSON.stringify(input.result) : null,
    endedAt: ctx.now(),
  };
  if (!(await endGitAction(ctx.db, id, ending))) throw conflict('It has ended already.');
  if (input.changes) {
    await saveLeft(ctx, { chatId: chat.id, version: id, runnerId: action.runnerId }, input.changes);
  }
  notifyGitAction(ctx, scope, { ...action, ...ending }, chat.projectId);
}
