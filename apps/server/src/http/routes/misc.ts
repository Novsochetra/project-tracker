import { join } from 'node:path';
import type { ServerMeta } from '@tracker/shared';
import { Hono } from 'hono';
import { listPeople, resetAllData } from '../../services/admin';
import type { ServiceContext } from '../../services/context';
import type { AppEnv } from '../env';
import { userContext } from '../userContext';

export interface MetaOptions {
  version: string;
  commit: string | null;
  repoRoot: string;
  publicUrl: string | null;
}

// The page's origin is no use to agents: under `npm run dev` it is Vite's. Vite's proxy sends
// API requests here with this server's host, so the request's own origin is the API's address.
export const serverMeta = (
  { version, commit, repoRoot, publicUrl }: MetaOptions,
  requestUrl: string,
  authRequired: boolean,
): ServerMeta => ({
  version,
  commit,
  serverUrl: publicUrl ?? new URL(requestUrl).origin,
  repoRoot,
  mcpEntry: join(repoRoot, 'apps', 'agent', 'dist', 'mcp.js'),
  cliEntry: join(repoRoot, 'apps', 'agent', 'dist', 'cli.js'),
  authRequired,
});

export const miscRoutes = (ctx: ServiceContext, meta: MetaOptions) =>
  new Hono<AppEnv>()
    .get('/health', (context) => context.json({ ok: true }))
    .get('/meta', (context) =>
      context.json(serverMeta(meta, context.req.url, context.get('access')?.kind !== 'open')),
    )
    .get('/people', async (context) => context.json(await listPeople(userContext(ctx, context))));

export const testResetRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>().post('/test/reset', async (context) => {
    await resetAllData(ctx);

    return context.body(null, 204);
  });
