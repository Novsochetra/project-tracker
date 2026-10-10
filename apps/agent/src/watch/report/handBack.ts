import { reportBlockFor, type RunJob } from '@tracker/shared';
import type { WatchApi } from '../watchApi';

export type HandBackApi = Pick<WatchApi, 'getTicket' | 'applyReport'>;

export interface HandBackDeps {
  api: HandBackApi;
  log: (text: string) => void;
  describe: (error: unknown) => string;
}

// submit_for_review and "Paste report" both leave a report entry, so one made since the run was
// taken means Claude used the tracker tools itself and the ticket must not get the report twice.
async function alreadyOnTheTicket(
  api: HandBackApi,
  { run }: RunJob,
  ticketKey: string,
): Promise<boolean> {
  const since = run.startedAt ?? run.createdAt;
  const { activity } = await api.getTicket(ticketKey, { fresh: true });
  return activity.some((entry) => entry.type === 'report' && entry.createdAt >= since);
}

// claude -p can only reach the tracker through its MCP tools. When those are missing or Claude
// just prints the report, the helper puts it on the ticket the way "Paste report" does (PT-155).
export async function handBackReport(
  { api, log, describe }: HandBackDeps,
  job: RunJob,
  output: string,
): Promise<void> {
  const { ticketKey } = job.run;
  const text = ticketKey ? reportBlockFor(output, ticketKey) : null;
  if (!ticketKey || !text) return;
  try {
    if (await alreadyOnTheTicket(api, job, ticketKey)) return;
    const { updatedTicketKeys } = await api.applyReport({ text, ticketKey });
    log(`Put Claude's report on ${updatedTicketKeys.join(', ') || ticketKey}.`);
  } catch (error) {
    log(`Couldn't put Claude's report on ${ticketKey}: ${describe(error)}`);
  }
}
