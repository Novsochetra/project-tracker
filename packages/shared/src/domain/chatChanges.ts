// What an Edit or Auto chat changed in the helper's folder (PT-237), and the commit or pull
// request the person asks the helper for.
export const CHAT_FILES_MAX = 300;
export const COMMIT_MESSAGE_MAX = 2000;
export const BRANCH_NAME_MAX = 100;
export const PR_TITLE_MAX = 200;
// A pull request's address; GitHub's are far shorter.
export const PR_URL_MAX = 500;
export const GIT_ERROR_MAX = 600;

export const GIT_ACTION_KINDS = ['commit', 'pull_request'] as const;
export type GitActionKind = (typeof GIT_ACTION_KINDS)[number];

export const GIT_ACTION_STATUSES = ['queued', 'running', 'done', 'failed'] as const;
export type GitActionStatus = (typeof GIT_ACTION_STATUSES)[number];
export const ENDED_GIT_ACTION_STATUSES = ['done', 'failed'] as const;

export const GIT_ACTION_LOST = 'The helper stopped before it finished. Try again.';
export const GH_NOT_SET_UP =
  'Open PR needs the GitHub CLI on your computer. Install gh and run `gh auth login` there, then try again.';
export const PROTECTED_BRANCH =
  'Nothing is pushed to the main branch. Commit to a new branch first, then open the pull request.';

export interface ChatChangedFile {
  path: string;
  // It had changes before the chat first touched it, so a commit leaves it out unless the person
  // picks it: those changes are the person's, not Claude's.
  dirtyBefore: boolean;
}

export interface ChatChanges {
  // The turn or the commit that sent these; a commit names it, so it never takes newer ones unseen.
  version: string;
  // The chat's files as they would be committed now, against the last commit.
  diff: string;
  cut: boolean;
  files: ChatChangedFile[];
  // Null on a detached HEAD.
  branch: string | null;
  defaultBranch: string | null;
  // The GitHub CLI is installed and signed in on the helper's computer.
  ghReady: boolean;
  createdAt: number;
}

export interface GitActionResult {
  sha?: string | undefined;
  branch?: string | undefined;
  url?: string | undefined;
}

export interface ChatGitAction {
  id: string;
  kind: GitActionKind;
  status: GitActionStatus;
  error: string | null;
  result: GitActionResult | null;
  createdAt: number;
  endedAt: number | null;
}

export interface ChatChangesAnswer {
  changes: ChatChanges | null;
  // The latest commit or pull request asked for in this chat.
  action: ChatGitAction | null;
}

// keep: the chat's files after the action, so the helper can send what is left to commit.
export type GitActionJob = {
  id: string;
  chatId: string;
  keep: ChatChangedFile[];
} & (
  | { kind: 'commit'; message: string; paths: string[]; branch: string | null }
  | { kind: 'pull_request'; title: string }
);

export interface ChatGitEvent {
  type: 'chat-git';
  actionId: string;
  runnerId: string;
  chatId: string;
  projectId: string;
  status: GitActionStatus;
}
