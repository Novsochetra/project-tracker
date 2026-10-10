import type { StepRow } from './stepRows';

// Enough to see what Claude is doing now without a long run filling the chat.
export const LIVE_STEPS_SHOWN = 5;

export interface VisibleSteps {
  shown: StepRow[];
  // Every step before the first one shown, those the tracker let go too, for "12 earlier steps".
  earlier: number;
  canExpand: boolean;
  // The tracker keeps a run's newest steps only (RUN_STEPS_KEPT), so the oldest may be gone.
  notKept: number;
}

const notKeptBefore = (rows: readonly StepRow[]): number => Math.max((rows[0]?.seq ?? 1) - 1, 0);

export function visibleSteps(
  rows: StepRow[],
  expanded: boolean,
  limit = LIVE_STEPS_SHOWN,
): VisibleSteps {
  const notKept = notKeptBefore(rows);
  const canExpand = rows.length > limit;
  const shown = expanded || !canExpand ? rows : rows.slice(-limit);
  return { shown, earlier: notKeptBefore(shown), canExpand, notKept };
}
