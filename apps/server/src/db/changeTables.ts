import type { ReviewVerdict } from '@tracker/shared';

export interface RunChangesRow {
  runId: string;
  ticketId: string;
  diff: string;
  // 0 or 1: no booleans (§2).
  cut: number;
  // The person's Approve or Ask for changes on these changes.
  verdict: ReviewVerdict | null;
  createdAt: number;
}

export interface ViewedFileRow {
  ticketId: string;
  path: string;
  digest: string;
  createdAt: number;
}

export interface ChangeTables {
  runChanges: RunChangesRow;
  ticketViewedFiles: ViewedFileRow;
}
