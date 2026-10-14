import { ACTIVE_RUN_STATUSES, type EndedRunStatus, type StatusCategory } from '@tracker/shared';
import type { Db } from '../db/schema';

export const listBatchTicketRows = (db: Db, batchIds: readonly string[]) =>
  batchIds.length === 0
    ? Promise.resolve([])
    : db
        .selectFrom('runs')
        .innerJoin('tickets', 'tickets.id', 'runs.ticketId')
        .select([
          'runs.id as runId',
          'runs.batchId',
          'runs.status',
          'tickets.num as ticketNum',
          'tickets.title as ticketTitle',
        ])
        .where('runs.batchId', 'in', batchIds)
        .orderBy('runs.createdAt')
        .orderBy('runs.id')
        .execute();

export interface BatchEnding {
  status: EndedRunStatus;
  error: string | null;
  endedAt: number;
}

// A sub agent claims its ticket (In progress) and submits it (Need review), so the ticket's run
// follows the ticket: that is all the tracker sees of a sub agent.
export async function advanceBatchTicket(
  db: Db,
  ticketId: string,
  category: StatusCategory,
  at: number,
): Promise<void> {
  // Only while the batch runs: a ticket moved before the helper takes it is still in its prompt.
  const ofTicket = db
    .updateTable('runs')
    .where('ticketId', '=', ticketId)
    .where((eb) =>
      eb(
        'batchId',
        'in',
        eb.selectFrom('runs as batch').select('batch.id').where('batch.status', '=', 'running'),
      ),
    );
  if (category === 'in_progress') {
    await ofTicket
      .set({ status: 'running', startedAt: at })
      .where('status', '=', 'queued')
      .execute();
    return;
  }
  if (category === 'todo') return;
  await ofTicket
    .set({ status: 'done', error: null, endedAt: at })
    .where('status', 'in', ACTIVE_RUN_STATUSES)
    .execute();
}

export const endBatchTickets = (db: Db, batchId: string, ending: BatchEnding) =>
  db
    .updateTable('runs')
    .set(ending)
    .where('batchId', '=', batchId)
    .where('status', 'in', ACTIVE_RUN_STATUSES)
    .returningAll()
    .execute();

// A batch can end without its tickets' runs, as when the helper goes silent or restarts, so every
// read that expires runs also ends what such a batch left.
export const endOrphanBatchTickets = (db: Db, ending: Omit<BatchEnding, 'status'>) =>
  db
    .updateTable('runs')
    .set({ ...ending, status: 'failed' })
    .where('batchId', 'is not', null)
    .where('status', 'in', ACTIVE_RUN_STATUSES)
    .where((eb) =>
      eb(
        'batchId',
        'not in',
        eb
          .selectFrom('runs as batch')
          .select('batch.id')
          .where('batch.kind', '=', 'batch')
          .where('batch.status', 'in', ACTIVE_RUN_STATUSES),
      ),
    )
    .returningAll()
    .execute();

export const failQueuedBatchesOf = (
  db: Db,
  runnerId: string,
  ending: Omit<BatchEnding, 'status'>,
) =>
  db
    .updateTable('runs')
    .set({ ...ending, status: 'failed' })
    .where('runnerId', '=', runnerId)
    .where('kind', '=', 'batch')
    .where('status', '=', 'queued')
    .returningAll()
    .execute();
