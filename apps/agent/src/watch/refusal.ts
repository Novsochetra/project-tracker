import type { RunJob } from '@tracker/shared';

export function refusalOf({ run }: RunJob, projectKey: string): string | undefined {
  if (run.ticketKey) {
    if (run.ticketKey.startsWith(`${projectKey}-`)) return undefined;
    return `This helper only runs ${projectKey} tickets, not ${run.ticketKey}.`;
  }
  if (run.projectKey === projectKey) return undefined;
  return `This helper only answers about ${projectKey}, not ${run.projectKey}.`;
}
