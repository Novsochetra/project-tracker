import { GIT_ACTION_LOST, type ChatChangedFile, type GitActionJob } from '@tracker/shared';
import type { UserScope } from '../../auth/scope';
import type { ChatGitActionRow } from '../../db/chatChangeTables';
import { findChatChanges } from '../../repositories/chatChanges';
import {
  endGitActions,
  markGitActionRunning,
  nextQueuedGitAction,
  type GitActionEnding,
} from '../../repositories/gitActions';
import { findChatInScope } from '../../repositories/chats';
import type { ServiceContext } from '../context';
import { requireRunner } from '../runners';
import { filesOf } from './chatChangesRows';
import { GIT_ACTION_NOT_TAKEN, GIT_ACTION_WAIT_MS } from './expireGitAction';
import { notifyGitAction } from './gitActionEvents';

interface CommitInput {
  message: string;
  paths: string[];
  branch: string | null;
  tree: string;
}

async function endAll(
  ctx: ServiceContext,
  scope: UserScope,
  where: Parameters<typeof endGitActions>[1],
  error: string,
) {
  const ending: GitActionEnding = { status: 'failed', error, result: null, endedAt: ctx.now() };
  for (const row of await endGitActions(ctx.db, where, ending)) await tell(ctx, scope, row);
}

async function tell(ctx: ServiceContext, scope: UserScope, row: ChatGitActionRow) {
  const chat = await findChatInScope(ctx.db, scope, row.chatId, ctx.now());
  if (chat) notifyGitAction(ctx, scope, row, chat.projectId);
}

function jobOf(row: ChatGitActionRow, files: ChatChangedFile[]): GitActionJob {
  const base = { id: row.id, chatId: row.chatId };
  if (row.kind === 'pull_request') {
    const { title } = JSON.parse(row.input) as { title: string };
    return { ...base, kind: 'pull_request', title, keep: files };
  }
  const input = JSON.parse(row.input) as CommitInput;
  const taken = new Set(input.paths);
  return { ...base, kind: 'commit', ...input, keep: files.filter((f) => !taken.has(f.path)) };
}

// A helper asks only between runs of its ticket lane, so one of its actions still running was
// lost in a restart.
export async function takeGitAction(
  ctx: ServiceContext,
  scope: UserScope,
  runnerId: string,
): Promise<GitActionJob | null> {
  const runner = await requireRunner(ctx, scope, runnerId);
  await endAll(ctx, scope, { runnerId: runner.id, status: 'running' }, GIT_ACTION_LOST);
  const before = ctx.now() - GIT_ACTION_WAIT_MS;
  await endAll(ctx, scope, { runnerId: runner.id, status: 'queued', before }, GIT_ACTION_NOT_TAKEN);
  const next = await nextQueuedGitAction(ctx.db, runner.id);
  if (!next || !(await markGitActionRunning(ctx.db, next.id))) return null;
  const changes = await findChatChanges(ctx.db, next.chatId);
  await tell(ctx, scope, { ...next, status: 'running' });
  return jobOf(next, changes ? filesOf(changes) : []);
}
