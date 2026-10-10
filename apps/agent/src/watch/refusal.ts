import type { RunJob } from '@tracker/shared';

export function refusalOf(job: RunJob, projectKey: string): string | undefined {
  if (job.run.ticketKey.startsWith(`${projectKey}-`)) return undefined;
  return `This helper only runs ${projectKey} tickets, not ${job.run.ticketKey}.`;
}
