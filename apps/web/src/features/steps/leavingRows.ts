import { lastSeq } from '../../api/runSteps';
import type { StepRow } from './stepRows';

// The rows a new step pushed out of the newest few. They fold away rather than vanish, which moved
// every row under them up by a row in one frame. Hiding earlier steps moves nothing new in, so
// those rows just go.
export function leavingRows(before: StepRow[], after: StepRow[]): StepRow[] {
  if (lastSeq(after) <= lastSeq(before)) return [];
  const first = after[0]?.seq ?? Infinity;
  return before.filter(({ seq }) => seq < first);
}
