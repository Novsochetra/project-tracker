import { RUN_STEPS_KEPT, type RunStep } from '@tracker/shared';

export const lastSeq = (steps: readonly RunStep[]): number => steps.at(-1)?.seq ?? 0;

// Reads can overlap or land late (a copy the service worker kept), so a page adds only the steps
// the cache lacks, and the list stays in seq order. Like the tracker, the phone keeps the newest
// RUN_STEPS_KEPT, so a long run watched live holds no more than a reload shows.
export function mergeSteps(have: RunStep[], page: readonly RunStep[]): RunStep[] {
  const known = new Set(have.map(({ seq }) => seq));
  const added = page.filter(({ seq }) => !known.has(seq));
  if (added.length === 0) return have;
  return [...have, ...added].sort((first, second) => first.seq - second.seq).slice(-RUN_STEPS_KEPT);
}
