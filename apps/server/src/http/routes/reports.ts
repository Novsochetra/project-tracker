import { reportInput } from '@tracker/shared';
import { Hono } from 'hono';
import type { ServiceContext } from '../../services/context';
import { applyReport, previewReport } from '../../services/reports';
import type { AppEnv } from '../env';
import { userContext } from '../userContext';
import { jsonBody } from '../validation';

export const reportRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>()
    .post('/reports/preview', jsonBody(reportInput), async (context) =>
      context.json(await previewReport(userContext(ctx, context), context.req.valid('json'))),
    )
    .post('/reports/apply', jsonBody(reportInput), async (context) =>
      context.json(
        await applyReport(
          userContext(ctx, context),
          context.get('actor'),
          context.req.valid('json'),
        ),
      ),
    );
