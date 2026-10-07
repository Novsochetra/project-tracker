import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { createDatabase } from '../../src/db/createDatabase';
import { createBroadcaster } from '../../src/events/broadcaster';
import { createMemoryStorage } from '../../src/storage/memoryStorage';

// serveStatic from @hono/node-server calls onFound after it has built the response,
// so Cache-Control headers set there never reached the browser.
describe('static cache headers', () => {
  const dist = mkdtempSync(join(tmpdir(), 'tracker-web-'));
  mkdirSync(join(dist, 'assets'));
  writeFileSync(join(dist, 'index.html'), '<!doctype html>');
  writeFileSync(join(dist, 'assets', 'app.js'), '');
  const db = createDatabase(':memory:');
  const app = createApp({
    db,
    storage: createMemoryStorage(),
    events: createBroadcaster(),
    webDist: dist,
  });

  afterAll(async () => {
    rmSync(dist, { recursive: true, force: true });
    await db.destroy();
  });

  it('reach the response for assets, the app shell and client routes', async () => {
    expect((await app.request('/assets/app.js')).headers.get('cache-control')).toContain(
      'immutable',
    );
    expect((await app.request('/')).headers.get('cache-control')).toBe('no-cache');
    expect((await app.request('/p/MA')).headers.get('cache-control')).toBe('no-cache');
  });
});
