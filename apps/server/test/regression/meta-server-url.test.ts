import type { ServerMeta } from '@tracker/shared';
import type { Hono } from 'hono';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { createDatabase } from '../../src/db/createDatabase';
import { createBroadcaster } from '../../src/events/broadcaster';
import type { AppEnv } from '../../src/http/env';
import { createMemoryStorage } from '../../src/storage/memoryStorage';

// The Connect sheet built the MCP command from the page's origin. Under `npm run dev` that is
// the Vite server, so agents registered in dev lost the tracker once it ran with `npm start`.
describe('regression: /api/meta tells agents the server’s own URL', () => {
  const db = createDatabase(':memory:');
  const deps = { db, storage: createMemoryStorage(), events: createBroadcaster() };

  afterAll(async () => {
    await db.destroy();
  });

  const serverUrl = async (app: Hono<AppEnv>, url: string): Promise<string> =>
    ((await (await app.request(url)).json()) as ServerMeta).serverUrl;

  // Vite's dev proxy changes the Host header to the API's, so this is the API even in dev.
  it('answers with the address the request reached', async () => {
    expect(await serverUrl(createApp(deps), 'http://localhost:4100/api/meta')).toBe(
      'http://localhost:4100',
    );
  });

  it('prefers PUBLIC_URL, for a server behind a reverse proxy', async () => {
    const app = createApp({ ...deps, publicUrl: 'https://tracker.example.com' });
    expect(await serverUrl(app, 'http://127.0.0.1:4100/api/meta')).toBe(
      'https://tracker.example.com',
    );
  });
});
