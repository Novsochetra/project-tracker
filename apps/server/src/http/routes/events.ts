import { HEARTBEAT_MS } from '@tracker/shared';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { Broadcaster } from '../../events/broadcaster';
import type { AppEnv } from '../env';

// Browsers never hand SSE comments to the page, so the heartbeat is a named event: the web app
// reopens a stream that misses two of them, which is how it notices a proxy holding a dead stream.
const PING = { event: 'ping', data: '' };

export const eventRoutes = (events: Broadcaster, heartbeatMs = HEARTBEAT_MS) =>
  new Hono<AppEnv>().get('/events', (c) =>
    streamSSE(c, async (stream) => {
      const unsubscribe = events.subscribe((event) => {
        void stream.writeSSE({ data: JSON.stringify(event) });
      });
      const heartbeat = setInterval(() => void stream.writeSSE(PING), heartbeatMs);
      try {
        // A comment line flushes the headers so proxies and clients see the stream open.
        await stream.write(': connected\n\n');
        await new Promise<void>((resolve) => stream.onAbort(resolve));
      } finally {
        clearInterval(heartbeat);
        unsubscribe();
      }
    }),
  );
