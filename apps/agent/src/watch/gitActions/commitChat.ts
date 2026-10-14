import {
  branchNameProblem,
  CHANGED_SINCE_LOOKED,
  type GitActionJob,
  type GitActionResult,
} from '@tracker/shared';
import { changedPaths } from '../changes/changedPaths';
import { snapshotTree } from '../changes/snapshot';
import { GitActionError, step, type StepContext } from './gitStep';
import { forgetRepo, restoreRepo, saveRepo } from './savedRepo';

type CommitJob = Extract<GitActionJob, { kind: 'commit' }>;

// git commit takes the files as they are now, so they must be as the person saw them.
async function requireAsSeen(context: StepContext, job: CommitJob): Promise<void> {
  const now = await snapshotTree(context.cwd, context.signal).catch(() => null);
  const changed =
    now &&
    (await changedPaths(context.cwd, { from: job.tree, to: now, paths: job.paths }, context.signal)
      .then(({ paths }) => paths.length > 0)
      .catch(() => true));
  if (changed !== false) throw new GitActionError(CHANGED_SINCE_LOOKED);
}

async function commitPicked(context: StepContext, job: CommitJob): Promise<GitActionResult> {
  if (job.branch) {
    await step(context, 'git', ['switch', '--create', job.branch], "Couldn't make the branch.");
  }
  await step(context, 'git', ['add', '--', ...job.paths], "Couldn't stage the files.");
  await step(
    context,
    'git',
    ['commit', `--message=${job.message}`, '--', ...job.paths],
    'The commit failed; nothing was committed.',
  );
  const sha = (
    await step(context, 'git', ['rev-parse', 'HEAD'], "Couldn't read the commit.")
  ).trim();
  const branch = (await step(context, 'git', ['branch', '--show-current'], '')).trim();
  return { sha, ...(branch ? { branch } : {}) };
}

// Only the files the person picked are staged and committed, by name after `--`; the rest of the
// index and the folder stay as they were. Git's own hooks run, as for any commit. One that fails
// puts the index and the branch back.
export async function commitChat(context: StepContext, job: CommitJob): Promise<GitActionResult> {
  const problem = job.branch ? branchNameProblem(job.branch) : null;
  if (problem) throw new GitActionError(problem);
  await requireAsSeen(context, job);
  const saved = await saveRepo(context);
  try {
    return await commitPicked(context, job);
  } catch (error) {
    await restoreRepo(context.cwd, saved, job.branch);
    throw error;
  } finally {
    await forgetRepo(saved);
  }
}
