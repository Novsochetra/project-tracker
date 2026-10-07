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
}

export const serverMeta = ({ version, repoRoot, authRequired }: MetaOptions): ServerMeta => ({
  version,
  repoRoot,
  mcpEntry: join(repoRoot, 'apps', 'agent', 'dist', 'mcp.js'),
  cliEntry: join(repoRoot, 'apps', 'agent', 'dist', 'cli.js'),
  authRequired,
});

export const miscRoutes = (ctx: ServiceContext, meta: MetaOptions) =>
  new Hono<AppEnv>()
    .get('/health', (c) => c.json({ ok: true }))
    .get('/meta', (c) => c.json(serverMeta(meta)))
    .get('/people', async (c) => c.json(await listPeople(ctx)));

export const testResetRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>().post('/test/reset', async (c) => {
    await resetAllData(ctx);
    return c.body(null, 204);
  });
