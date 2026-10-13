import { runnerTools, type RunnerTools } from '@tracker/shared';
import type { RunnerRow } from '../db/runTables';

export function parseRunnerTools({ tools }: Pick<RunnerRow, 'tools'>): RunnerTools | null {
  if (tools === null) return null;
  try {
    return runnerTools.safeParse(JSON.parse(tools)).data ?? null;
  } catch {
    return null;
  }
}
