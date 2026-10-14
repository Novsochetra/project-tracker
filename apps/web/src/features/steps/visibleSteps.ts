import { withoutTodoSteps } from '../todos/latestTodos';
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

export interface VisibleOptions {
  limit?: number;
  // The to-do list shows above the steps, so the calls that wrote it would only repeat it.
  hideTodos?: boolean;
}

export function visibleSteps(
  rows: StepRow[],
  expanded: boolean,
  { limit = LIVE_STEPS_SHOWN, hideTodos = false }: VisibleOptions = {},
): VisibleSteps {
  const notKept = notKeptBefore(rows);
  const listed = hideTodos ? withoutTodoSteps(rows) : rows;
  const canExpand = listed.length > limit;
  const shown = expanded || !canExpand ? listed : listed.slice(-limit);
  return { shown, earlier: notKept + listed.length - shown.length, canExpand, notKept };
}
