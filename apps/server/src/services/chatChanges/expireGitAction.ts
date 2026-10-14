import { GIT_ACTION_LOST, RUNNER_ONLINE_MS } from '@tracker/shared';
import type { UserScope } from '../../auth/scope';
import type { ChatGitActionRow } from '../../db/chatChangeTables';
import { findRunnerRow } from '../../repositories/runners';
import { endGitAction, latestGitAction } from '../../repositories/gitActions';
import type { ServiceContext } from '../context';
import { notifyGitAction } from './gitActionEvents';

// Long enough for a laptop to wake; a commit the person asked for long ago isn't made by surprise.
export const GIT_ACTION_WAIT_MS = 10 * 60_000;
export const GIT_ACTION_NOT_TAKEN = "Your computer didn't take it in time. Try again.";

export const isOnline = (lastSeenAt: number, now: number): boolean =>
  now - lastSeenAt < RUNNER_ONLINE_MS;

async function whyEnded(ctx: ServiceContext, row: ChatGitActionRow): Promise<string | null> {
  const now = ctx.now();
  if (row.status === 'queued') {
    return now - row.createdAt >= GIT_ACTION_WAIT_MS ? GIT_ACTION_NOT_TAKEN : null;
  }
  if (row.status !== 'running') return null;
  const runner = await findRunnerRow(ctx.db, row.runnerId);
  return runner && isOnline(runner.lastSeenAt, now) ? null : GIT_ACTION_LOST;
}

// Ended when the chat is read or asked to commit, so a helper that is gone never leaves the phone
// waiting: one queued too long wasn't taken, and one running on a helper that went silent was lost.
export async function expireGitAction(
  ctx: ServiceContext,
  scope: UserScope,
  chat: { id: string; projectId: string },
): Promise<void> {
  const latest = await latestGitAction(ctx.db, chat.id);
  const error = latest ? await whyEnded(ctx, latest) : null;
  if (!latest || !error) return;
  const from = latest.status === 'queued' ? 'queued' : 'running';
  const ending = { status: 'failed' as const, error, result: null, endedAt: ctx.now() };
  if (await endGitAction(ctx.db, latest.id, ending, from)) {
    notifyGitAction(ctx, scope, { ...latest, ...ending }, chat.projectId);
  }
}
