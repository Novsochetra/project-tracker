import { createMiddleware } from 'hono/factory';
import { secureHeaders } from 'hono/secure-headers';
import type { AppEnv } from './env';

// Hono's defaults: HSTS (browsers ignore it over plain http, so local runs are unaffected),
// nosniff, no framing by other sites, no referrer, same-origin resources and opener. No
// Content-Security-Policy here: it would replace the sandbox one text attachments are served with.
export const securityHeaders = () => secureHeaders();

// A proxy that buffers or compresses a live-update stream holds the events and pings back, and
// the web app then reopens a stream that is fine. no-transform asks every proxy not to; nginx-style
// proxies also read X-Accel-Buffering.
export const unbufferedStreams = createMiddleware<AppEnv>(async (c, next) => {
  await next();
  if (!c.res.headers.get('Content-Type')?.startsWith('text/event-stream')) return;
  c.res.headers.set('Cache-Control', 'no-cache, no-transform');
  c.res.headers.set('X-Accel-Buffering', 'no');
});
