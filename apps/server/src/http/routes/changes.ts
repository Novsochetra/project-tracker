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
    .post('/runs/:id/changes', helperOnly, jsonBody(addRunChangesInput), async (c) => {
      const scope = requireScope(c.get('access'));
      await addRunChanges(ctx, scope, c.req.param('id'), c.req.valid('json'));
      return c.body(null, 204);
    })
    .get('/tickets/:key/changes', async (c) =>
      c.json(await readTicketChanges(userContext(ctx, c), c.req.param('key'))),
    )
    .put(
      '/tickets/:key/changes/viewed',
      personReviewsChanges,
      jsonBody(viewedFileInput),
      async (c) => {
        await setFileViewed(userContext(ctx, c), c.req.param('key'), c.req.valid('json'));
        return c.body(null, 204);
      },
    )
    .post(
      '/tickets/:key/changes/verdict',
      personReviewsChanges,
      jsonBody(changesVerdictInput),
      async (c) =>
        c.json(
          await changesVerdict(
            userContext(ctx, c),
            c.get('actor'),
            c.req.param('key'),
            c.req.valid('json'),
          ),
        ),
    );
