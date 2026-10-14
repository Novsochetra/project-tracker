import {
  branchNameProblem,
  GH_NOT_SET_UP,
  isProtectedBranch,
  PR_URL_MAX,
  PROTECTED_BRANCH,
  type GitActionJob,
  type GitActionResult,
} from '@tracker/shared';
import { currentBranch, defaultBranch, ghReady } from '../changes/repoState';
import { GitActionError, step, type StepContext } from './gitStep';

type PullRequestJob = Extract<GitActionJob, { kind: 'pull_request' }>;

const BODY = 'Opened from a chat in the project tracker.';
const URL = /^https:\/\/\S+$/;

// gh's default branch is GitHub's own word on it, whatever origin/HEAD says on this computer.
async function protectedOf(context: StepContext): Promise<string | null> {
  const local = await defaultBranch(context.cwd, context.signal);
  const args = ['repo', 'view', '--json', 'defaultBranchRef', '--jq', '.defaultBranchRef.name'];
  const remote = (
    await step(context, 'gh', args, "Couldn't read the repository on GitHub.")
  ).trim();
  return remote || local;
}

async function branchToPush(
  context: StepContext,
): Promise<{ branch: string; base: string | null }> {
  const branch = await currentBranch(context.cwd, context.signal);
  if (!branch) throw new GitActionError('Check out a branch first: HEAD is detached.');
  const base = await protectedOf(context);
  if (isProtectedBranch(branch, base)) throw new GitActionError(PROTECTED_BRANCH);
  const problem = branchNameProblem(branch);
  if (problem) throw new GitActionError(problem);
  return { branch, base };
}

const urlOf = (out: string): string | undefined => {
  const last = out.trim().split('\n').at(-1)?.trim() ?? '';
  return URL.test(last) && last.length <= PR_URL_MAX ? last : undefined;
};

// The branch goes to the same name on origin, named in full, so no push setting sends it to main.
export async function openPullRequest(
  context: StepContext,
  job: PullRequestJob,
): Promise<GitActionResult> {
  if (!(await ghReady(context.cwd))) throw new GitActionError(GH_NOT_SET_UP);
  const { branch, base } = await branchToPush(context);
  const ref = `refs/heads/${branch}`;
  await step(
    context,
    'git',
    ['push', '--set-upstream', 'origin', `${ref}:${ref}`],
    'The push failed.',
  );
  const args = ['pr', 'create', `--head=${branch}`, `--title=${job.title}`, `--body=${BODY}`];
  const out = await step(
    context,
    'gh',
    base ? [...args, `--base=${base}`] : args,
    "Couldn't open the pull request.",
  );
  const url = urlOf(out);
  return { branch, ...(url ? { url } : {}) };
}
