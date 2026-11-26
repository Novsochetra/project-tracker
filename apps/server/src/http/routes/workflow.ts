import { reviewInput, submitWorkInput } from '@tracker/shared';
import { Hono } from 'hono';
import type { ServiceContext } from '../../services/context';
import { claimNext, claimTicket, reviewTicket, submitWork } from '../../services/workflow';
import type { AppEnv } from '../env';
import { userContext } from '../userContext';
import { jsonBody } from '../validation';

export const workflowRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>()
    .post('/projects/:key/claim', async (context) => {
      const detail = await claimNext(
        userContext(ctx, context),
        context.get('actor'),
        context.req.param('key'),
      );

      return detail ? context.json(detail) : context.body(null, 204);
    })
    .post('/tickets/:key/claim', async (context) =>
      context.json(
        await claimTicket(
          userContext(ctx, context),
          context.get('actor'),
          context.req.param('key'),
        ),
      ),
    )
    .post('/tickets/:key/submit', jsonBody(submitWorkInput), async (context) =>
      context.json(
        await submitWork(
          userContext(ctx, context),
          context.get('actor'),
          context.req.param('key'),
          context.req.valid('json'),
        ),
      ),
    )
    .post('/tickets/:key/review', jsonBody(reviewInput), async (context) =>
      context.json(
        await reviewTicket(
          userContext(ctx, context),
          context.get('actor'),
          context.req.param('key'),
          context.req.valid('json'),
        ),
      ),
    );
