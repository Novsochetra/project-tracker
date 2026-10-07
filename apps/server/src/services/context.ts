import type { Clock } from '../clock';
import type { Db } from '../db/schema';
import type { Broadcaster } from '../events/broadcaster';
import type { FileStorage } from '../storage/fileStorage';

export interface ServiceContext {
  db: Db;
  storage: FileStorage;
  events: Broadcaster;
  now: Clock;
}

export const inTransaction = <T>(ctx: ServiceContext, work: (trx: Db) => Promise<T>): Promise<T> =>
  ctx.db.transaction().execute(work);

export function notify(
  ctx: ServiceContext,
  projectId: string | null,
  ticketId: string | null = null,
): void {
  ctx.events.publish({ type: 'changed', projectId, ticketId });
}
