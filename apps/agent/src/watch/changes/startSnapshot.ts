import type { Run } from '@tracker/shared';
import { runName } from '../runName';
import { snapshotTree } from './snapshot';

// For all the git calls of one end together, so a large folder can't hold up the run for long.
export const GIT_DEADLINE_MS = 30_000;

export interface SnapshotDeps {
  cwd: string;
  log: (text: string) => void;
  // Tests only.
  deadlineMs?: number | undefined;
}

export const gitDeadline = (deps: Pick<SnapshotDeps, 'deadlineMs'>): AbortSignal =>
  AbortSignal.timeout(deps.deadlineMs ?? GIT_DEADLINE_MS);

// Said in the window, so the person knows why no changes come; git's own words can name files.
export const trackingOff = (deadline: AbortSignal): string =>
  deadline.aborted
    ? `git took longer than ${GIT_DEADLINE_MS / 1000} s`
    : "git couldn't read the folder";

// Null outside a git repository, which tracks nothing and says nothing.
export async function startSnapshot(deps: SnapshotDeps, run: Run): Promise<string | null> {
  const deadline = gitDeadline(deps);
  try {
    return await snapshotTree(deps.cwd, deadline);
  } catch {
    deps.log(`${runName(run)}: Changes aren't tracked in this run: ${trackingOff(deadline)}.`);
    return null;
  }
}
