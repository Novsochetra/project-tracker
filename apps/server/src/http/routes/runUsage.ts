import { Hono } from 'hono';
import { requireScope } from '../../auth/scope';
import type { ServiceContext } from '../../services/context';
import { listPlanUsage } from '../../services/planUsage';
import { getProjectUsage } from '../../services/projectUsage';
import type { AppEnv } from '../env';
import { personReadsPlanUsage } from '../personOnly';

export const runUsageRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>()
    .get('/projects/:key/usage', async (context) =>
      context.json(
        await getProjectUsage(ctx, requireScope(context.get('access')), context.req.param('key')),
      ),
    )
    .get('/claude-usage', personReadsPlanUsage, async (context) =>
      context.json(await listPlanUsage(ctx, requireScope(context.get('access')))),
    );
