import { addRunStepsInput, runStepsQuery } from '@tracker/shared';
import { Hono } from 'hono';
import { requireScope } from '../../auth/scope';
import type { ServiceContext } from '../../services/context';
import { addRunSteps, listRunSteps } from '../../services/runSteps';
import type { AppEnv } from '../env';
import { helperOnly } from '../helperOnly';
import { personReadsSteps } from '../personOnly';
import { jsonBody, queryParams } from '../validation';

export const runStepRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>()
    .post('/runs/:id/steps', helperOnly, jsonBody(addRunStepsInput), async (context) => {
      const scope = requireScope(context.get('access'));
      await addRunSteps(ctx, scope, context.req.param('id'), context.req.valid('json'));

      return context.body(null, 204);
    })
    .get('/runs/:id/steps', personReadsSteps, queryParams(runStepsQuery), async (context) => {
      const scope = requireScope(context.get('access'));
      const { after } = context.req.valid('query');

      return context.json(await listRunSteps(ctx, scope, context.req.param('id'), after));
    });
