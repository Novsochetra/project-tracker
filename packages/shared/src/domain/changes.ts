import type { ReviewVerdict } from './activity';

export const DIFF_SIDES = ['old', 'new'] as const;
export type DiffSide = (typeof DIFF_SIDES)[number];

// A change of this size reads on a phone a file at a time, and its JSON body stays under the
// tracker's 1 MB limit even with every character escaped.
export const RUN_DIFF_MAX = 150_000;
export const DIFF_PATH_MAX = 1_000;
export const DIFF_DIGEST_MAX = 16;

// A comment on one line of a run's changes: the old side is the line before the change.
export interface LineRef {
  runId: string;
  path: string;
  side: DiffSide;
  line: number;
}

export interface TicketChanges {
  runId: string;
  diff: string;
  // The diff was longer than RUN_DIFF_MAX, so its end is missing.
  cut: boolean;
  createdAt: number;
  verdict: ReviewVerdict | null;
  // Path to the digest of the file's change when it was ticked, so a file that changed again
  // shows as not viewed.
  viewed: Record<string, string>;
}

export interface TicketChangesAnswer {
  changes: TicketChanges | null;
}
