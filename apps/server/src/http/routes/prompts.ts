import { markSentInput } from '@tracker/shared';
import { Hono } from 'hono';
import type { ServiceContext } from '../../services/context';
import { markSent } from '../../services/markSent';
import { projectPrompt, ticketPrompt } from '../../services/prompts';
import type { AppEnv } from '../env';
import { userContext } from '../userContext';
import { jsonBody } from '../validation';

export const promptRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>()
    .get('/projects/:key/prompt', async (context) =>
      context.json(await projectPrompt(userContext(ctx, context), context.req.param('key'))),
    )
    .get('/tickets/:key/prompt', async (context) =>
      context.json(await ticketPrompt(userContext(ctx, context), context.req.param('key'))),
    )
    .post('/tickets/:key/sent', jsonBody(markSentInput), async (context) =>
      context.json(
        await markSent(
          userContext(ctx, context),
          context.get('actor'),
          context.req.param('key'),
          context.req.valid('json'),
        ),
      ),
    );
