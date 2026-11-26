export const RANK_STEP = 1000;

export interface Rankable {
  id: string;
  rank: number;
  num: number;
}

export const byRank = (left: Rankable, right: Rankable): number =>
  left.rank - right.rank || right.num - left.num;

export function topRank(group: readonly Rankable[]): number {
  if (group.length === 0) return 0;

  return Math.min(...group.map((ticket) => ticket.rank)) - RANK_STEP;
}

export function evenRanks(ids: readonly string[]): Map<string, number> {
  return new Map(ids.map((id, index) => [id, index * RANK_STEP]));
}
