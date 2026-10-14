import {
  finishRunInput,
  registerRunnerInput,
  runnerId,
  startRunInput,
  takeRunQuery,
} from '@tracker/shared';
import { Hono, type Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { requireScope } from '../../auth/scope';
import type { ServiceContext } from '../../services/context';
import { listRunActivity } from '../../services/runActivity';
import { takeNextRun } from '../../services/runQueue';
import { listRunners, registerRunner, removeRunner } from '../../services/runners';
import { cancelRun, endRun, getRun, listTicketRuns, startRun } from '../../services/runs';
import type { AppEnv } from '../env';
import { helperOnly } from '../helperOnly';
import { personOnly } from '../personOnly';
import { jsonBody, queryParams, rejectInvalid } from '../validation';

const scope = (c: Context<AppEnv>) => requireScope(c.get('access'));

const validRunnerId = createMiddleware<AppEnv>(async (c, next) => {
  rejectInvalid(runnerId.safeParse(c.req.param('id')));
  await next();
});

const ticketRunRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>()
    .post('/tickets/:key/runs', personOnly, jsonBody(startRunInput), async (c) =>
      c.json(await startRun(ctx, scope(c), c.req.param('key'), c.req.valid('json')), 201),
    )
    .get('/tickets/:key/runs', async (c) =>
      c.json(await listTicketRuns(ctx, scope(c), c.req.param('key'))),
    )
    .get('/run-activity', async (c) => c.json(await listRunActivity(ctx, scope(c))))
    .get('/runs/:id', async (c) => c.json(await getRun(ctx, scope(c), c.req.param('id'))))
    .post('/runs/:id/cancel', async (c) =>
      c.json(await cancelRun(ctx, scope(c), c.req.param('id'))),
    )
    .post('/runs/:id/finish', helperOnly, jsonBody(finishRunInput), async (c) =>
      c.json(await endRun(ctx, scope(c), c.req.param('id'), c.req.valid('json'))),
    );

const runnerRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>()
    .get('/runners', async (c) => c.json(await listRunners(ctx, scope(c))))
    .put('/runners/:id', helperOnly, validRunnerId, jsonBody(registerRunnerInput), async (c) =>
      c.json(await registerRunner(ctx, scope(c), c.req.param('id'), c.req.valid('json'))),
    )
    .delete('/runners/:id', async (c) => {
      await removeRunner(ctx, scope(c), c.req.param('id'));
      return c.body(null, 204);
    })
    .post('/runners/:id/next', helperOnly, queryParams(takeRunQuery), async (c) => {
      const { kind, batches } = c.req.valid('query');
      const take = { lane: kind, batches: batches === '1' };
      const job = await takeNextRun(ctx, scope(c), c.req.param('id'), take);
      return job ? c.json(job) : c.body(null, 204);
    });

export const runRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>().route('/', ticketRunRoutes(ctx)).route('/', runnerRoutes(ctx));
