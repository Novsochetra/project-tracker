import type { GitActionKind, GitActionStatus } from '@tracker/shared';

export interface ChatChangesRow {
  chatId: string;
  // The ask run or the git action that sent them (ChatChanges.version).
  version: string;
  // The helper whose folder these are; a commit goes to it.
  runnerId: string;
  diff: string;
  // 0 or 1: no booleans (§2).
  cut: number;
  // ChatChangedFile[] as JSON text.
  files: string;
  branch: string | null;
  defaultBranch: string | null;
  ghReady: number;
  createdAt: number;
}

export interface ChatGitActionRow {
  id: string;
  chatId: string;
  runnerId: string;
  kind: GitActionKind;
  // The commit's message, files and branch, or the pull request's title, as JSON text.
  input: string;
  status: GitActionStatus;
  error: string | null;
  // GitActionResult as JSON text.
  result: string | null;
  createdAt: number;
  endedAt: number | null;
}

export interface ChatChangeTables {
  chatChanges: ChatChangesRow;
  chatGitActions: ChatGitActionRow;
}
