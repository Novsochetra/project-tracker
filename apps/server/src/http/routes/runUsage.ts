import { Hono } from 'hono';
import { requireScope } from '../../auth/scope';
import type { ServiceContext } from '../../services/context';
import { getProjectUsage } from '../../services/projectUsage';
import type { AppEnv } from '../env';

export const runUsageRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>().get('/projects/:key/usage', async (c) =>
    c.json(await getProjectUsage(ctx, requireScope(c.get('access')), c.req.param('key'))),
  );
