import {
  branchNameProblem,
  isProtectedBranch,
  isSecretPath,
  proposedBranch,
  type ChatChangedFile,
  type ChatChanges,
} from '@tracker/shared';

// The person's own edits and files that may hold secrets are theirs to pick.
export const pickedFirst = (file: ChatChangedFile): boolean =>
  !file.dirtyBefore && !isSecretPath(file.path);

export const initialPicks = (files: readonly ChatChangedFile[]): ReadonlySet<string> =>
  new Set(files.filter(pickedFirst).map((file) => file.path));

// On the main branch the commit goes to a new one, so it can become a pull request.
export function initialBranch(changes: ChatChanges, title: string): string {
  const { branch, defaultBranch } = changes;
  if (branch && !isProtectedBranch(branch, defaultBranch)) return branch;
  return proposedBranch(title);
}

export interface CommitValues {
  message: string;
  branch: string;
  picks: ReadonlySet<string>;
}

export function commitProblem(values: CommitValues, changes: ChatChanges): string | null {
  if (!values.message.trim()) return 'Write a commit message.';
  if (values.picks.size === 0) return 'Pick at least one file.';
  const branch = values.branch.trim();
  if (!branch && !changes.branch) return 'Name a branch to commit on.';
  if (!branch || branch === changes.branch) return null;
  if (isProtectedBranch(branch, changes.defaultBranch)) return `${branch} is the main branch.`;
  return branchNameProblem(branch);
}

// A branch only when it is a new one; the current one is left out.
export function commitInput(values: CommitValues, changes: ChatChanges) {
  const branch = values.branch.trim();
  return {
    version: changes.version,
    message: values.message.trim(),
    paths: changes.files.map((file) => file.path).filter((path) => values.picks.has(path)),
    ...(branch && branch !== changes.branch ? { branch } : {}),
  };
}

export const canOpenPullRequest = (changes: ChatChanges): boolean =>
  changes.ghReady &&
  changes.branch !== null &&
  !isProtectedBranch(changes.branch, changes.defaultBranch);
