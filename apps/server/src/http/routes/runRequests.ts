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

const scope = (c: Context<AppEnv>) => requireScope(c.get('access'));

export const runRequestRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>()
    .post('/runs/:id/requests', helperOnly, jsonBody(addRunRequestInput), async (c) =>
      c.json(await addRunRequest(ctx, scope(c), c.req.param('id'), c.req.valid('json')), 201),
    )
    .get('/runs/:id/requests', personReadsRequests, async (c) =>
      c.json(await listRunRequests(ctx, scope(c), c.req.param('id'))),
    )
    .post('/requests/:id/answer', personAnswers, jsonBody(answerRunRequestInput), async (c) =>
      c.json(await answerRunRequest(ctx, scope(c), c.req.param('id'), c.req.valid('json'))),
    )
    .get('/requests/:id/wait', helperOnly, queryParams(waitRunRequestQuery), async (c) =>
      c.json(
        await waitForRunRequest(ctx, scope(c), c.req.param('id'), {
          runnerId: c.req.valid('query').runnerId,
          signal: c.req.raw.signal,
        }),
      ),
    )
    .post('/requests/:id/cancel', helperOnly, jsonBody(cancelRunRequestInput), async (c) =>
      c.json(await cancelRunRequest(ctx, scope(c), c.req.param('id'), c.req.valid('json'))),
    );
