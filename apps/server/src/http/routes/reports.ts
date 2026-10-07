import { reportInput } from '@tracker/shared';
import { Hono } from 'hono';
import type { ServiceContext } from '../../services/context';
import { applyReport, previewReport } from '../../services/reports';
import type { AppEnv } from '../env';
import { jsonBody } from '../validation';

export const reportRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>()
    .post('/reports/preview', jsonBody(reportInput), async (c) =>
      c.json(await previewReport(ctx, c.req.valid('json'))),
    )
    .post('/reports/apply', jsonBody(reportInput), async (c) =>
      c.json(await applyReport(ctx, c.get('actor'), c.req.valid('json'))),
    );
