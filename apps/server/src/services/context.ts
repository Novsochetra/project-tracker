import type { UserScope } from '../auth/scope';
import type { Clock } from '../clock';
import type { Db } from '../db/schema';
import type { Broadcaster } from '../events/broadcaster';
import type { Pusher } from '../push/pusher';
import type { FileStorage } from '../storage/fileStorage';

export interface ServiceContext {
  db: Db;
  storage: FileStorage;
  events: Broadcaster;
  now: Clock;
  push: Pusher;
}

// A request's context: whose request it is decides which projects it can reach (lookups.ts).
export interface UserContext extends ServiceContext {
  scope: UserScope;
}

export const forUser = (ctx: ServiceContext, scope: UserScope): UserContext => ({ ...ctx, scope });

export const inTransaction = <T>(ctx: ServiceContext, work: (trx: Db) => Promise<T>): Promise<T> =>
  ctx.db.transaction().execute(work);

// Only the user can change their projects, so the change is theirs to hear about. A change across
// projects names none, which has every screen read again what it shows.
export function notify(
  ctx: UserContext,
  projectId: string | null,
  ticketId: string | null = null,
): void {
  ctx.events.publish({ userId: ctx.scope, event: { type: 'changed', projectId, ticketId } });
}
