import type { FinishRunInput, RunUsage } from '@tracker/shared';
import type { RunUsageColumns } from '../db/runTables';

export const usageOfFinish = ({ usage }: FinishRunInput): RunUsageColumns => ({
  costMicros: usage?.costMicros ?? null,
  turns: usage?.turns ?? null,
  durationMs: usage?.durationMs ?? null,
  contextTokens: usage?.contextTokens ?? null,
  contextWindow: usage?.contextWindow ?? null,
  tokens: usage?.tokens ?? null,
});

// Older helpers send none, and a run Claude never finished has none, so it shows nothing extra.
export function usageOfRow(row: RunUsage): RunUsage | null {
  const { costMicros, turns, durationMs } = row;
  if (costMicros === null && turns === null && durationMs === null) return null;
  return { costMicros, turns, durationMs };
}
