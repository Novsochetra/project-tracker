import { DIFF_SIDES, type Activity, type DiffSide, type LineRef } from '@tracker/shared';
import { readableEntries } from '../../../lib/entries';
import type { LineAt } from '../../changes/diffLines';

// One id for a line of a run's changes: its comments, its open box and its kept draft.
export const lineId = (runId: string, path: string, { side, line }: LineAt): string =>
  JSON.stringify([runId, path, side, line]);

const isSide = (side: unknown): side is DiffSide => DIFF_SIDES.includes(side as DiffSide);

// The tracker may send an entry in a shape this app doesn't expect; such a line is no line.
export function commentLine(activity: Activity): LineRef | null {
  const line: unknown = activity.line;
  if (typeof line !== 'object' || line === null) return null;
  const { runId, path, side, line: number } = line as Record<string, unknown>;
  if (typeof runId !== 'string' || typeof path !== 'string' || typeof number !== 'number') {
    return null;
  }
  return isSide(side) ? { runId, path, side, line: number } : null;
}

// The run's line comments, oldest first, by line.
export function lineThreads(activity: readonly Activity[], runId: string): Map<string, Activity[]> {
  const threads = new Map<string, Activity[]>();
  for (const item of readableEntries(activity)) {
    const line = item.type === 'comment' ? commentLine(item) : null;
    if (!line || line.runId !== runId) continue;
    const id = lineId(runId, line.path, line);
    threads.set(id, [...(threads.get(id) ?? []), item]);
  }
  return threads;
}

export const commentCount = (threads: ReadonlyMap<string, readonly Activity[]>): number =>
  [...threads.values()].reduce((sum, thread) => sum + thread.length, 0);
