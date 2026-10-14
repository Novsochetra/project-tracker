export const CHANGES_LABEL = 'Changes';
export const NO_CHANGES_TITLE = 'No changes';
export const NO_CHANGES_TEXT = 'Claude changed no files in this chat.';
export const COMMIT_LABEL = 'Commit';
export const OPEN_PR_LABEL = 'Open PR';
export const MESSAGE_LABEL = 'Commit message';
export const BRANCH_LABEL = 'Branch';
export const FILES_LABEL = 'Files to commit';
export const PR_TITLE_LABEL = 'Pull request title';
export const PUSH_LABEL = 'Push and open';
export const DIRTY_NOTE = 'Had your own changes before Claude touched it.';
export const SECRET_NOTE = 'May hold secrets.';
export const PICK_NOTE =
  'Files with your own changes or secrets are left out unless you pick them.';
export const GH_NOTE =
  'Open PR needs the GitHub CLI on your computer: install gh and run gh auth login there.';
export const MAIN_NOTE =
  'Commit to a new branch to open a pull request. Nothing is pushed to the main branch.';
export const DETACHED_NOTE =
  'Your computer has no branch checked out, so a commit needs a new one.';

export const fileCount = (count: number): string => (count === 1 ? '1 file' : `${count} files`);

export const onBranch = (branch: string | null): string =>
  branch ? `On ${branch}` : 'No branch checked out';

export const pushQuestion = (branch: string, base: string | null): string =>
  `Push ${branch} to GitHub and open a pull request into ${base ?? 'its default branch'}?`;
