import type { ChatChangedFile, ChatChanges, ChatGitAction, GitActionResult } from '@tracker/shared';
import type { ChatChangesRow, ChatGitActionRow } from '../../db/chatChangeTables';

function parseJson<T>(text: string | null, fallback: T): T {
  if (text === null) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

export const filesOf = (row: ChatChangesRow): ChatChangedFile[] =>
  parseJson<ChatChangedFile[]>(row.files, []);

export const toChatChanges = (row: ChatChangesRow): ChatChanges => ({
  version: row.version,
  diff: row.diff,
  cut: row.cut === 1,
  files: filesOf(row),
  branch: row.branch,
  defaultBranch: row.defaultBranch,
  ghReady: row.ghReady === 1,
  createdAt: row.createdAt,
});

export const toGitAction = (row: ChatGitActionRow): ChatGitAction => ({
  id: row.id,
  kind: row.kind,
  status: row.status,
  error: row.error,
  result: parseJson<GitActionResult | null>(row.result, null),
  createdAt: row.createdAt,
  endedAt: row.endedAt,
});

export const isActive = (row: ChatGitActionRow | undefined): boolean =>
  row?.status === 'queued' || row?.status === 'running';
