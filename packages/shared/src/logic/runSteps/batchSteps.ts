import type { RunStepInput } from '../../domain/runStep';

export interface BatchTicketRun {
  runId: string;
  ticketKey: string;
}

export interface BatchStepsSoFar {
  // A sub agent's Start step toolId to its ticket's run, from the steps the tickets already have.
  owners: ReadonlyMap<string, string>;
  // The batch's Start steps, for a sub agent that names its ticket only when it claims it.
  starts: ReadonlyMap<string, RunStepInput>;
}

// Bounded on both sides, so a label that is one long word costs linear time, not quadratic.
const KEY = /(?<![A-Za-z0-9])[A-Za-z0-9]{1,20}-\d{1,10}(?!\d)/g;
const CLAIM = /\bclaim/i;

// Only a key of this batch's tickets counts, and only when the label names just one of them.
export function ticketRunIn(label: string, tickets: readonly BatchTicketRun[]): string | null {
  const said = new Set((label.match(KEY) ?? []).map((key) => key.toUpperCase()));
  const named = tickets.filter(({ ticketKey }) => said.has(ticketKey.toUpperCase()));
  return named.length === 1 && named[0] ? named[0].runId : null;
}

// On its ticket the sub agent is the whole run, so its steps show unindented there.
const asTicketStep = (step: RunStepInput): RunStepInput => ({
  ...step,
  subAgent: false,
  parentToolId: null,
});

const isStart = (step: RunStepInput): boolean =>
  step.kind === 'agent' && !step.subAgent && step.toolId !== null;

// A Run all is one Claude with a sub agent per ticket. Each sub agent's steps also go to its
// ticket's run, tied by the Start step's description or, when that names no single ticket, the
// sub agent's claim. The description comes first because it arrives first: the ticket shows its
// sub agent from the start, and Claude writes it from the batch's own ticket list.
export function batchTicketSteps(
  steps: readonly RunStepInput[],
  tickets: readonly BatchTicketRun[],
  soFar: BatchStepsSoFar,
): Map<string, RunStepInput[]> {
  const owners = new Map(soFar.owners);
  const starts = new Map(soFar.starts);
  const routed = new Map<string, RunStepInput[]>();
  const give = (runId: string, step: RunStepInput) =>
    routed.set(runId, [...(routed.get(runId) ?? []), asTicketStep(step)]);
  // The Start step goes first on the ticket, since its toolId is how later requests find the owner.
  const own = (toolId: string, runId: string) => {
    owners.set(toolId, runId);
    give(
      runId,
      starts.get(toolId) ?? { kind: 'agent', label: 'Start sub agent', subAgent: false, toolId },
    );
  };
  for (const step of steps) {
    if (isStart(step) && step.toolId) {
      starts.set(step.toolId, step);
      const runId = ticketRunIn(step.label, tickets);
      if (runId) own(step.toolId, runId);
      continue;
    }
    const parent = step.parentToolId;
    if (!parent) continue;
    // Only a call claims: Claude's words may name a ticket it chose not to take.
    const claims = step.kind === 'tool' && CLAIM.test(step.label);
    const claimed = claims ? ticketRunIn(step.label, tickets) : null;
    if (!owners.has(parent) && claimed) own(parent, claimed);
    const owner = owners.get(parent);
    if (owner) give(owner, step);
  }
  return routed;
}
