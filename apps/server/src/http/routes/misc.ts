import { join } from 'node:path';
import type { ServerMeta } from '@tracker/shared';
import { Hono } from 'hono';
import { listPeople, resetAllData } from '../../services/admin';
import type { ServiceContext } from '../../services/context';
import type { AppEnv } from '../env';

export interface MetaOptions {
  version: string;
  repoRoot: string;
  authRequired: boolean;
  publicUrl: string | null;
}

// The page's origin is no use to agents: under `npm run dev` it is Vite's. Vite's proxy sends
// API requests here with this server's host, so the request's own origin is the API's address.
export const serverMeta = (
  { version, repoRoot, authRequired, publicUrl }: MetaOptions,
  requestUrl: string,
): ServerMeta => ({
  version,
  serverUrl: publicUrl ?? new URL(requestUrl).origin,
  repoRoot,
  mcpEntry: join(repoRoot, 'apps', 'agent', 'dist', 'mcp.js'),
  cliEntry: join(repoRoot, 'apps', 'agent', 'dist', 'cli.js'),
  authRequired,
});

export const miscRoutes = (ctx: ServiceContext, meta: MetaOptions) =>
  new Hono<AppEnv>()
    .get('/health', (c) => c.json({ ok: true }))
    .get('/meta', (c) => c.json(serverMeta(meta, c.req.url)))
    .get('/people', async (c) => c.json(await listPeople(ctx)));

export const testResetRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>().post('/test/reset', async (c) => {
    await resetAllData(ctx);
    return c.body(null, 204);
  });
