import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { Broadcaster } from '../../events/broadcaster';
import type { AppEnv } from '../env';

export const HEARTBEAT_MS = 25_000;

export const eventRoutes = (events: Broadcaster, heartbeatMs = HEARTBEAT_MS) =>
  new Hono<AppEnv>().get('/events', (c) =>
    streamSSE(c, async (stream) => {
      const unsubscribe = events.subscribe((event) => {
        void stream.writeSSE({ data: JSON.stringify(event) });
      });
      const heartbeat = setInterval(() => void stream.write(': heartbeat\n\n'), heartbeatMs);
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
