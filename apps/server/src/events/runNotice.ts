import type { RunEvent } from '@tracker/shared';
import type { UserScope } from '../auth/scope';
import type { Broadcaster } from './broadcaster';

// The user stays on the server; streams get the event alone.
export interface RunNotice {
  userId: UserScope;
  event: RunEvent;
}

export type RunBroadcaster = Broadcaster<RunNotice>;
