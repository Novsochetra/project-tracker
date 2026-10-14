import type { FinishGitActionInput, GitActionJob, GitActionResult } from '@tracker/shared';
import { readChatChanges } from '../changes/readChatChanges';
import { snapshotTree } from '../changes/snapshot';
import type { WatchApi } from '../watchApi';
import { commitChat } from './commitChat';
import { GitActionError, type StepContext } from './gitStep';
import { openPullRequest } from './openPullRequest';

export interface GitActionDeps {
  api: Pick<WatchApi, 'finishGitAction'>;
  cwd: string;
  runnerId: string;
  log: (text: string) => void;
  // Tests only.
  deadlineMs?: number | undefined;
}

// A hook or a push can take a while; past this the action fails rather than hold the lane.
const ACTION_DEADLINE_MS = 120_000;
const SEND_TIMEOUT_MS = 30_000;
const WHAT = { commit: 'The commit', pull_request: 'The pull request' } as const;
const TIMED_OUT = 'Git took longer than 2 minutes, so it was stopped.';

const act = (context: StepContext, job: GitActionJob): Promise<GitActionResult> =>
  job.kind === 'commit' ? commitChat(context, job) : openPullRequest(context, job);

// What is left to commit, so the phone shows it; none when git can't say.
async function leftOver(context: StepContext, job: GitActionJob) {
  try {
    const to = await snapshotTree(context.cwd, context.signal);
    if (!to) return undefined;
    return await readChatChanges(context.cwd, { files: job.keep, to, cut: false }, context.signal);
  } catch {
    return undefined;
  }
}

function failure(error: unknown, signal: AbortSignal): string {
  if (error instanceof GitActionError) return error.message;
  if (signal.aborted) return TIMED_OUT;
  return "Git or gh couldn't run on your computer.";
}

async function outcomeOf(deps: GitActionDeps, job: GitActionJob): Promise<FinishGitActionInput> {
  const signal = AbortSignal.timeout(deps.deadlineMs ?? ACTION_DEADLINE_MS);
  const context = { cwd: deps.cwd, signal };
  const chat = `chat ${job.chatId.slice(0, 8)}`;
  try {
    const result = await act(context, job);
    deps.log(`${chat}: ${WHAT[job.kind]} is done.`);
    const changes = await leftOver(context, job);
    return { runnerId: deps.runnerId, status: 'done', result, ...(changes ? { changes } : {}) };
  } catch (error) {
    deps.log(`${chat}: ${WHAT[job.kind]} failed.`);
    return { runnerId: deps.runnerId, status: 'failed', error: failure(error, signal) };
  }
}

export async function runGitAction(deps: GitActionDeps, job: GitActionJob): Promise<void> {
  const outcome = await outcomeOf(deps, job);
  await deps.api.finishGitAction(job.id, outcome, { signal: AbortSignal.timeout(SEND_TIMEOUT_MS) });
}
