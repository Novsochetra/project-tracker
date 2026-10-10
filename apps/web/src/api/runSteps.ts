import type { RunStep } from '@tracker/shared';

export const lastSeq = (steps: readonly RunStep[]): number => steps.at(-1)?.seq ?? 0;

// Reads can overlap or land late (one cancelled by the next event, a copy the service worker kept),
// so a page adds only the steps it has that the cache lacks, and the list stays in seq order.
export function mergeSteps(have: RunStep[], page: readonly RunStep[]): RunStep[] {
  const known = new Set(have.map(({ seq }) => seq));
  const added = page.filter(({ seq }) => !known.has(seq));
  if (added.length === 0) return have;
  return [...have, ...added].sort((first, second) => first.seq - second.seq);
}
