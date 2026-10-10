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
    .post('/runs/:id/steps', helperOnly, jsonBody(addRunStepsInput), async (c) => {
      const scope = requireScope(c.get('access'));
      await addRunSteps(ctx, scope, c.req.param('id'), c.req.valid('json'));
      return c.body(null, 204);
    })
    .get('/runs/:id/steps', personReadsSteps, queryParams(runStepsQuery), async (c) => {
      const scope = requireScope(c.get('access'));
      const { after } = c.req.valid('query');
      return c.json(await listRunSteps(ctx, scope, c.req.param('id'), after));
    });
