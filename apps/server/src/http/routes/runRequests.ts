import {
  addRunRequestInput,
  answerRunRequestInput,
  cancelRunRequestInput,
  waitRunRequestQuery,
} from '@tracker/shared';
import { Hono, type Context } from 'hono';
import { requireScope } from '../../auth/scope';
import type { ServiceContext } from '../../services/context';
import { addRunRequest, answerRunRequest, listRunRequests } from '../../services/runRequests';
import { cancelRunRequest } from '../../services/runRequestCancel';
import { waitForRunRequest } from '../../services/runRequestWait';
import type { AppEnv } from '../env';
import { helperOnly } from '../helperOnly';
import { personAnswers, personReadsRequests } from '../personOnly';
import { jsonBody, queryParams } from '../validation';

const scope = (context: Context<AppEnv>) => requireScope(context.get('access'));

export const runRequestRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>()
    .post('/runs/:id/requests', helperOnly, jsonBody(addRunRequestInput), async (context) =>
      context.json(
        await addRunRequest(
          ctx,
          scope(context),
          context.req.param('id'),
          context.req.valid('json'),
        ),
        201,
      ),
    )
    .get('/runs/:id/requests', personReadsRequests, async (context) =>
      context.json(await listRunRequests(ctx, scope(context), context.req.param('id'))),
    )
    .post('/requests/:id/answer', personAnswers, jsonBody(answerRunRequestInput), async (context) =>
      context.json(
        await answerRunRequest(
          ctx,
          scope(context),
          context.req.param('id'),
          context.req.valid('json'),
        ),
      ),
    )
    .get('/requests/:id/wait', helperOnly, queryParams(waitRunRequestQuery), async (context) =>
      context.json(
        await waitForRunRequest(ctx, scope(context), context.req.param('id'), {
          runnerId: context.req.valid('query').runnerId,
          signal: context.req.raw.signal,
        }),
      ),
    )
    .post('/requests/:id/cancel', helperOnly, jsonBody(cancelRunRequestInput), async (context) =>
      context.json(
        await cancelRunRequest(
          ctx,
          scope(context),
          context.req.param('id'),
          context.req.valid('json'),
        ),
      ),
    );
