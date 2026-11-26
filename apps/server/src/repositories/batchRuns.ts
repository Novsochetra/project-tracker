import { ACTIVE_RUN_STATUSES, type EndedRunStatus } from '@tracker/shared';
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
          'runs.ticketId',
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
