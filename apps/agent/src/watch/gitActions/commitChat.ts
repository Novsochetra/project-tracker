import { branchNameProblem, type GitActionJob, type GitActionResult } from '@tracker/shared';
import { GitActionError, step, type StepContext } from './gitStep';

type CommitJob = Extract<GitActionJob, { kind: 'commit' }>;

// Only the files the person picked are staged and committed, by name after `--`; the rest of the
// index and the folder stay as they were. Git's own hooks run, as for any commit.
export async function commitChat(context: StepContext, job: CommitJob): Promise<GitActionResult> {
  if (job.branch) {
    const problem = branchNameProblem(job.branch);
    if (problem) throw new GitActionError(problem);
    await step(context, 'git', ['switch', '--create', job.branch], "Couldn't make the branch.");
  }
  await step(context, 'git', ['add', '--', ...job.paths], "Couldn't stage the files.");
  await step(
    context,
    'git',
    ['commit', `--message=${job.message}`, '--', ...job.paths],
    'The commit failed; the files are left staged.',
  );
  const sha = (
    await step(context, 'git', ['rev-parse', 'HEAD'], "Couldn't read the commit.")
  ).trim();
  const branch = (await step(context, 'git', ['branch', '--show-current'], '')).trim();
  return { sha, ...(branch ? { branch } : {}) };
}
