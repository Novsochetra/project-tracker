import type { RunActivity, RunAllResult } from '@tracker/shared';

export interface ProjectRunCounts {
  running: number;
  waiting: number;
}

export function projectRunCounts(
  activity: RunActivity | undefined,
  projectKey: string,
): ProjectRunCounts {
  const runs = (activity?.runs ?? []).filter((run) => run.projectKey === projectKey);
  return {
    running: runs.filter((run) => run.state === 'running').length,
    waiting: runs.filter((run) => run.state === 'waiting').length,
  };
}

export const runCountsText = ({ running, waiting }: ProjectRunCounts, limit: number): string =>
  `${running} running · ${waiting} waiting · limit ${limit}`;

const tickets = (count: number): string => (count === 1 ? '1 ticket' : `${count} tickets`);

const startedText = ({ queued, maxParallel }: RunAllResult): string =>
  queued === 0
    ? 'No tickets to run'
    : `Started 1 run for ${tickets(queued)}, up to ${maxParallel} at once`;

export function runAllToast(result: RunAllResult): string {
  const { skippedActive, skippedDevice } = result;
  const head = startedText(result);
  const skipped = [
    skippedActive > 0 ? `${skippedActive} already running or waiting` : '',
    skippedDevice > 0 ? `${skippedDevice} ${skippedDevice === 1 ? 'needs' : 'need'} a device` : '',
  ].filter(Boolean);
  const text = skipped.length > 0 ? `${head}. Skipped ${skipped.join(', ')}.` : `${head}.`;
  return result.leftOver > 0 ? `${text} ${result.leftOver} more wait for the next Run all.` : text;
}
