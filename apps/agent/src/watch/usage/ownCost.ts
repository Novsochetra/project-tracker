import type { ResultUsage } from '../stream/claudeResult';
import type { SessionMark } from './sessionMarks';

export interface CostSource {
  // The final result's figures: the cost and tokens are the session's so far.
  final: ResultUsage;
  readTokens: number;
  resumed: boolean;
  before: SessionMark | undefined;
}

// On --resume Claude Code starts from the session's cost and tokens when it was the last session
// used in this folder (checked with Claude Code 2.1.296: a follow-up reported both runs' cost).
// Tokens Claude Code counted that this run didn't stream tell whether it did: at least the
// session's earlier tokens means it carried them, fewer are calls it doesn't stream (WebFetch
// reads a page with a small model). Unknown is left out rather than counted twice.
export function ownCostUsd({ final, readTokens, resumed, before }: CostSource): number | undefined {
  const { costUsd } = final;
  if (costUsd === undefined || !resumed) return costUsd;
  if (final.readTokens === undefined) return undefined;
  const unstreamed = final.readTokens - readTokens;
  if (unstreamed <= 0) return costUsd;
  if (!before) return undefined;
  if (unstreamed < before.readTokens) return costUsd;
  return Math.max(0, costUsd - before.costUsd);
}
