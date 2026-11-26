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

const scope = (context: Context<AppEnv>) => requireScope(context.get('access'));

const validRunnerId = createMiddleware<AppEnv>(async (context, next) => {
  rejectInvalid(runnerId.safeParse(context.req.param('id')));
  await next();
});

const ticketRunRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>()
    .post('/tickets/:key/runs', personOnly, jsonBody(startRunInput), async (context) =>
      context.json(
        await startRun(ctx, scope(context), context.req.param('key'), context.req.valid('json')),
        201,
      ),
    )
    .get('/tickets/:key/runs', async (context) =>
      context.json(await listTicketRuns(ctx, scope(context), context.req.param('key'))),
    )
    .get('/run-activity', async (context) =>
      context.json(await listRunActivity(ctx, scope(context))),
    )
    .get('/runs/:id', async (context) =>
      context.json(await getRun(ctx, scope(context), context.req.param('id'))),
    )
    .post('/runs/:id/cancel', async (context) =>
      context.json(await cancelRun(ctx, scope(context), context.req.param('id'))),
    )
    .post('/runs/:id/finish', helperOnly, jsonBody(finishRunInput), async (context) =>
      context.json(
        await endRun(ctx, scope(context), context.req.param('id'), context.req.valid('json')),
      ),
    );

const runnerRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>()
    .get('/runners', async (context) => context.json(await listRunners(ctx, scope(context))))
    .put(
      '/runners/:id',
      helperOnly,
      validRunnerId,
      jsonBody(registerRunnerInput),
      async (context) =>
        context.json(
          await registerRunner(
            ctx,
            scope(context),
            context.req.param('id'),
            context.req.valid('json'),
          ),
        ),
    )
    .delete('/runners/:id', async (context) => {
      await removeRunner(ctx, scope(context), context.req.param('id'));

      return context.body(null, 204);
    })
    .post('/runners/:id/next', helperOnly, queryParams(takeRunQuery), async (context) => {
      const { kind, batches } = context.req.valid('query');
      const take = { lane: kind, batches: batches === '1' };
      const job = await takeNextRun(ctx, scope(context), context.req.param('id'), take);

      return job ? context.json(job) : context.body(null, 204);
    });

export const runRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>().route('/', ticketRunRoutes(ctx)).route('/', runnerRoutes(ctx));
