import { addRunChangesInput, changesVerdictInput, viewedFileInput } from '@tracker/shared';
import { Hono } from 'hono';
import { requireScope } from '../../auth/scope';
import { addRunChanges } from '../../services/changes/addRunChanges';
import { changesVerdict } from '../../services/changes/changesVerdict';
import { readTicketChanges, setFileViewed } from '../../services/changes/readChanges';
import type { ServiceContext } from '../../services/context';
import type { AppEnv } from '../env';
import { helperOnly } from '../helperOnly';
import { personReviewsChanges } from '../personOnly';
import { userContext } from '../userContext';
import { jsonBody } from '../validation';

export const changesRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>()
    .post('/runs/:id/changes', helperOnly, jsonBody(addRunChangesInput), async (context) => {
      const scope = requireScope(context.get('access'));
      await addRunChanges(ctx, scope, context.req.param('id'), context.req.valid('json'));

      return context.body(null, 204);
    })
    .get('/tickets/:key/changes', async (context) =>
      context.json(await readTicketChanges(userContext(ctx, context), context.req.param('key'))),
    )
    .put(
      '/tickets/:key/changes/viewed',
      personReviewsChanges,
      jsonBody(viewedFileInput),
      async (context) => {
        await setFileViewed(
          userContext(ctx, context),
          context.req.param('key'),
          context.req.valid('json'),
        );

        return context.body(null, 204);
      },
    )
    .post(
      '/tickets/:key/changes/verdict',
      personReviewsChanges,
      jsonBody(changesVerdictInput),
      async (context) =>
        context.json(
          await changesVerdict(
            userContext(ctx, context),
            context.get('actor'),
            context.req.param('key'),
            context.req.valid('json'),
          ),
        ),
    );
