import type { RunJob, RunKind } from '@tracker/shared';

export interface Lane {
  projectKey: string;
  kind: RunKind;
}

// Only a ticket run may use the helper's own permission mode, so anything else is refused.
export function refusalOf({ run }: RunJob, { projectKey, kind }: Lane): string | undefined {
  if (run.kind !== kind)
    return `This helper expected a run of kind "${kind}", not "${String(run.kind)}".`;
  if (kind === 'ask') {
    if (run.projectKey === projectKey) return undefined;
    return `This helper only answers about ${projectKey}, not ${run.projectKey}.`;
  }
  if (!run.ticketKey) return 'This ticket run has no ticket.';
  if (run.ticketKey.startsWith(`${projectKey}-`)) return undefined;
  return `This helper only runs ${projectKey} tickets, not ${run.ticketKey}.`;
}
