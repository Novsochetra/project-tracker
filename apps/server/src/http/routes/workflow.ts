import { reviewInput, submitWorkInput } from '@tracker/shared';
import { Hono } from 'hono';
import type { ServiceContext } from '../../services/context';
import { claimNext, claimTicket, reviewTicket, submitWork } from '../../services/workflow';
import type { AppEnv } from '../env';
import { jsonBody } from '../validation';

export const workflowRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>()
    .post('/projects/:key/claim', async (c) => {
      const detail = await claimNext(ctx, c.get('actor'), c.req.param('key'));
      return detail ? c.json(detail) : c.body(null, 204);
    })
    .post('/tickets/:key/claim', async (c) =>
      c.json(await claimTicket(ctx, c.get('actor'), c.req.param('key'))),
    )
    .post('/tickets/:key/submit', jsonBody(submitWorkInput), async (c) =>
      c.json(await submitWork(ctx, c.get('actor'), c.req.param('key'), c.req.valid('json'))),
    )
    .post('/tickets/:key/review', jsonBody(reviewInput), async (c) =>
      c.json(await reviewTicket(ctx, c.get('actor'), c.req.param('key'), c.req.valid('json'))),
    );
