import { laneOf, type RunJob, type RunKind } from '@tracker/shared';

export interface Lane {
  projectKey: string;
  kind: RunKind;
}

const projectRefusal = ({ run }: RunJob, projectKey: string): string | undefined => {
  if (run.kind === 'ask') {
    if (run.projectKey === projectKey) return undefined;
    return `This helper only answers about ${projectKey}, not ${run.projectKey}.`;
  }
  if (!run.ticketKey) return 'This ticket run has no ticket.';
  if (run.ticketKey.startsWith(`${projectKey}-`)) return undefined;
  return `This helper only runs ${projectKey} tickets, not ${run.ticketKey}.`;
};

// The helper's own permission mode is only for runs of the ticket lane, so a run that belongs in
// another lane is refused: an Ask or Plan question there would get it, an Edit one in the ask lane
// would change the folder beside a ticket run.
export function refusalOf(job: RunJob, { projectKey, kind }: Lane): string | undefined {
  const lane = laneOf(job.run.kind, job.run.askOptions);
  if (lane !== kind)
    return `This helper's ${kind} lane does not take runs of the "${String(lane)}" lane.`;
  return projectRefusal(job, projectKey);
}
