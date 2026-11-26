import type { SearchMatch, TicketSearchHit } from '@tracker/shared';

const MATCH_ORDER: Record<SearchMatch, number> = { key: 0, title: 1, description: 2, recent: 3 };

// The tracker sends each kind of match newest first; within a kind, the open project's come first.
export function rankTicketHits(
  hits: readonly TicketSearchHit[],
  currentProjectKey: string | null,
): TicketSearchHit[] {
  const current = currentProjectKey?.toUpperCase() ?? null;
  const here = (hit: TicketSearchHit) => (hit.projectKey.toUpperCase() === current ? 0 : 1);

  return hits
    .map((hit, index) => ({ hit, index }))
    .sort(
      (left, right) =>
        MATCH_ORDER[left.hit.match] - MATCH_ORDER[right.hit.match] ||
        here(left.hit) - here(right.hit) ||
        left.index - right.index,
    )
    .map(({ hit }) => hit);
}
