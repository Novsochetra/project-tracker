import { batchTicketSteps, formatTicketKey, type RunStepInput } from '@tracker/shared';
import type { RunRow, RunStepRow } from '../db/runTables';
import type { Db } from '../db/schema';
import { listBatchTicketRows } from '../repositories/batchRuns';
import {
  countMoreTicketSteps,
  dropOldTicketSteps,
  listBatchStarts,
  listStepOwners,
} from '../repositories/batchSteps';
import { insertRunSteps } from '../repositories/runSteps';
import type { RunWithKey } from '../repositories/runs';
import { rowsOf } from './runStepRows';

export interface TicketStepCount {
  run: Pick<RunRow, 'id' | 'projectId' | 'ticketId' | 'chatId'>;
  count: number;
}

const startOf = (row: RunStepRow): RunStepInput => ({
  kind: row.kind,
  label: row.label,
  subAgent: row.subAgent === 1,
  toolId: row.toolId,
});

const parentsOf = (steps: readonly RunStepInput[]): string[] => [
  ...new Set(steps.flatMap(({ parentToolId }) => (parentToolId ? [parentToolId] : []))),
];

async function stepsSoFar(trx: Db, batchId: string, ticketRunIds: string[], parents: string[]) {
  const owned = await listStepOwners(trx, ticketRunIds, parents);
  const owners = new Map(owned.map((row) => [row.toolId ?? '', row.runId]));
  const unowned = parents.filter((toolId) => !owners.has(toolId));
  const starts = await listBatchStarts(trx, batchId, unowned);
  return { owners, starts: new Map(starts.map((row) => [row.toolId ?? '', startOf(row)])) };
}

// Steps for a ticket whose run already ended, such as a sub agent's last words after it submitted
// the ticket, stay on the batch alone.
export async function addBatchTicketSteps(
  trx: Db,
  batch: RunWithKey,
  steps: readonly RunStepInput[],
  at: number,
): Promise<TicketStepCount[]> {
  if (batch.kind !== 'batch') return [];
  const rows = await listBatchTicketRows(trx, [batch.id]);
  const tickets = rows.map((row) => ({
    runId: row.runId,
    ticketKey: formatTicketKey(batch.projectKey, row.ticketNum),
  }));
  const ticketRunIds = tickets.map(({ runId }) => runId);
  const soFar = await stepsSoFar(trx, batch.id, ticketRunIds, parentsOf(steps));
  const counts: TicketStepCount[] = [];
  for (const [runId, routed] of batchTicketSteps(steps, tickets, soFar)) {
    const count = await countMoreTicketSteps(trx, runId, routed.length);
    const row = rows.find((ticket) => ticket.runId === runId);
    if (count === undefined || !row) continue;
    await insertRunSteps(trx, rowsOf(runId, routed, count, at));
    await dropOldTicketSteps(trx, runId, count);
    const run = { id: runId, projectId: batch.projectId, ticketId: row.ticketId, chatId: null };
    counts.push({ run, count });
  }
  return counts;
}
