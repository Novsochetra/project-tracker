import { gitOutput } from './gitOutput';

const SMALL = 4_000;

async function line(cwd: string, args: readonly string[]): Promise<string | null> {
  const { text, code } = await gitOutput(cwd, args, SMALL);
  const value = text.trim();
  return code === 0 && value ? value : null;
}

export interface BranchFacts {
  branch: string | null;
  defaultBranch: string | null;
  mergeBase: string | null;
  start: string;
}

// On a branch of its own the ticket's change is all of the branch since it left the default one;
// on the default branch, what changed since the run started.
export function pickBase({ branch, defaultBranch, mergeBase, start }: BranchFacts): string {
  if (!branch || !defaultBranch || branch === defaultBranch.replace(/^origin\//, '')) return start;
  return mergeBase ?? start;
}

// The commit the folder is on when a run starts; null outside a git repository with a commit.
export const headOf = (cwd: string): Promise<string | null> =>
  line(cwd, ['rev-parse', '--verify', '--quiet', 'HEAD']);

async function defaultBranchOf(cwd: string): Promise<string | null> {
  const remote = await line(cwd, [
    'symbolic-ref',
    '--quiet',
    '--short',
    'refs/remotes/origin/HEAD',
  ]);
  if (remote) return remote;
  for (const name of ['main', 'master']) {
    if (await line(cwd, ['rev-parse', '--verify', '--quiet', `refs/heads/${name}`])) return name;
  }
  return null;
}

export async function diffBaseOf(cwd: string, start: string): Promise<string> {
  const branch = await line(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const defaultBranch = await defaultBranchOf(cwd);
  const mergeBase = defaultBranch ? await line(cwd, ['merge-base', 'HEAD', defaultBranch]) : null;
  return pickBase({ branch, defaultBranch, mergeBase, start });
}
