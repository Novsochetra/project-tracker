import { HEARTBEAT_MS } from '@tracker/shared';
import { Hono } from 'hono';
import { streamSSE, type SSEMessage, type SSEStreamingApi } from 'hono/streaming';
import type { Access } from '../../auth/access';
import { scopeOf } from '../../auth/scope';
import type { Broadcaster } from '../../events/broadcaster';
import type { RunBroadcaster, RunNotice } from '../../events/runNotice';
import type { AppEnv } from '../env';

// Browsers never hand SSE comments to the page, so the heartbeat is a named event: the web app
// reopens a stream that misses two of them, which is how it notices a proxy holding a dead stream.
const PING = { event: 'ping', data: '' };

export type AccessCheck = (access: Access | null | undefined) => Promise<boolean>;

const alwaysAllowed: AccessCheck = () => Promise.resolve(true);

// A stream outlives the check its request passed. Before each write it checks again, so a stream
// whose session ended or whose token was revoked gets nothing more and closes. Writes wait in
// line, so events keep their order.
function guardedWriter(stream: SSEStreamingApi, allowed: () => Promise<boolean>, end: () => void) {
  let queue = Promise.resolve();
  return (message: SSEMessage) => {
    queue = queue
      .then(async () => {
        if (await allowed()) await stream.writeSSE(message);
        else end();
      })
      .catch(end);
  };
}

// A run event reaches only the streams of the run's own user, as a named `run` event the web app's
// change handling never sees.
function runListener(access: Access | null | undefined, send: (message: SSEMessage) => void) {
  const scope = scopeOf(access);
  return ({ userId, event }: RunNotice) => {
    if (scope !== undefined && userId === scope)
      send({ event: 'run', data: JSON.stringify(event) });
  };
}

export const eventRoutes = (
  events: Broadcaster,
  heartbeatMs = HEARTBEAT_MS,
  stillAllowed: AccessCheck = alwaysAllowed,
  runs?: RunBroadcaster,
) =>
  new Hono<AppEnv>().get('/events', (c) => {
    const access = c.get('access');
    return streamSSE(c, async (stream) => {
      let end = () => undefined as void;
      const ended = new Promise<void>((resolve) => {
        end = resolve;
        stream.onAbort(resolve);
      });
      const send = guardedWriter(stream, () => stillAllowed(access), end);
      const unsubscribe = events.subscribe((event) => send({ data: JSON.stringify(event) }));
      const unsubscribeRuns = runs?.subscribe(runListener(access, send));
      const heartbeat = setInterval(() => send(PING), heartbeatMs);
      try {
        // A comment line flushes the headers so proxies and clients see the stream open.
        await stream.write(': connected\n\n');
        await ended;
      } finally {
        clearInterval(heartbeat);
        unsubscribe();
        unsubscribeRuns?.();
      }
    });
  });
