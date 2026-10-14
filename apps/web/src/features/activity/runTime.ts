import { formatRelative, type ActivityRun } from '@tracker/shared';

const MINUTE = 60_000;

export function formatElapsed(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / MINUTE);
  if (minutes < 1) return 'under 1m';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export type TimedRun = Pick<ActivityRun, 'state' | 'startedAt' | 'createdAt'>;

export function runTimeText(run: TimedRun, now: number): string {
  switch (run.state) {
    case 'running':
      return formatElapsed(now - (run.startedAt ?? run.createdAt));
    case 'waiting':
      return `waiting ${formatElapsed(now - run.createdAt)}`;
    case 'failed':
      return formatRelative(run.startedAt ?? run.createdAt, now);
  }
}

export const STATE_LABEL = { running: 'Running', waiting: 'Waiting', failed: 'Failed' } as const;

export const limitText = (runningCount: number, limit: number): string =>
  `${runningCount} running now · limit ${limit}`;
