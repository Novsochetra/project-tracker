import type { FinishRunInput, RunUsage } from '@tracker/shared';

export const usageOfFinish = ({ usage }: FinishRunInput): RunUsage => ({
  costMicros: usage?.costMicros ?? null,
  turns: usage?.turns ?? null,
  durationMs: usage?.durationMs ?? null,
});

// Older helpers send none, and a run Claude never finished has none, so it shows nothing extra.
export function usageOfRow(row: RunUsage): RunUsage | null {
  const { costMicros, turns, durationMs } = row;
  if (costMicros === null && turns === null && durationMs === null) return null;
  return { costMicros, turns, durationMs };
}
