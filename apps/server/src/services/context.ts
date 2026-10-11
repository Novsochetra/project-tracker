import type { UserScope } from '../auth/scope';
import type { Clock } from '../clock';
import type { Db } from '../db/schema';
import type { Broadcaster } from '../events/broadcaster';
import type { RunBroadcaster } from '../events/runNotice';
import type { FileStorage } from '../storage/fileStorage';

export interface ServiceContext {
  db: Db;
  storage: FileStorage;
  events: Broadcaster;
  runEvents: RunBroadcaster;
  now: Clock;
}

// A request's context: whose request it is decides which projects it can reach (lookups.ts).
export interface UserContext extends ServiceContext {
  scope: UserScope;
}

export const forUser = (ctx: ServiceContext, scope: UserScope): UserContext => ({ ...ctx, scope });

export const inTransaction = <T>(ctx: ServiceContext, work: (trx: Db) => Promise<T>): Promise<T> =>
  ctx.db.transaction().execute(work);

// Only the user can change their projects, so the change is theirs to hear about.
export function notify(ctx: UserContext, projectId: string, ticketId: string | null = null): void {
  ctx.events.publish({ userId: ctx.scope, event: { type: 'changed', projectId, ticketId } });
}
