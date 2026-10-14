import { changesFolder, type AddChatChangesInput } from '@tracker/shared';
import type { UserScope } from '../../auth/scope';
import { conflict, forbidden } from '../../errors';
import { saveChatChanges } from '../../repositories/chatChanges';
import type { ServiceContext } from '../context';
import { requireRun } from '../runs';

// The helper sends them as an Edit or Auto question's turn ends and before it ends the run; the
// run's end tells the phone.
export async function addChatChanges(
  ctx: ServiceContext,
  scope: UserScope,
  id: string,
  input: AddChatChangesInput,
): Promise<void> {
  const run = await requireRun(ctx, scope, id);
  if (run.runnerId !== input.runnerId) {
    throw forbidden('Only the helper that took this run sends its changes.');
  }
  if (run.kind !== 'ask' || run.chatId === null || !changesFolder(run.askMode)) {
    throw conflict("Only an Edit or Auto question keeps its chat's changes.");
  }
  if (run.status !== 'running') throw conflict(`This run is not running (${run.status}).`);
  await saveChatChanges(ctx.db, {
    chatId: run.chatId,
    version: run.id,
    runnerId: input.runnerId,
    tree: input.tree,
    diff: input.diff,
    cut: input.cut ? 1 : 0,
    files: JSON.stringify(input.files),
    branch: input.branch,
    defaultBranch: input.defaultBranch,
    ghReady: input.ghReady ? 1 : 0,
    createdAt: ctx.now(),
  });
}
