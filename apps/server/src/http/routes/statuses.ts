import { createStatusInput, reorderStatusesInput, updateStatusInput } from '@tracker/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import type { ServiceContext } from '../../services/context';
import { createStatus, deleteStatus, reorderStatuses, updateStatus } from '../../services/statuses';
import type { AppEnv } from '../env';
import { personEditsStatuses } from '../personOnly';
import { userContext } from '../userContext';
import { jsonBody, queryParams } from '../validation';

const deleteStatusQuery = z.object({ moveTo: z.string().max(64).optional() });

export const statusRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>()
    .post('/projects/:key/statuses', personEditsStatuses, jsonBody(createStatusInput), async (c) =>
      c.json(await createStatus(userContext(ctx, c), c.req.param('key'), c.req.valid('json')), 201),
    )
    .put(
      '/projects/:key/statuses/order',
      personEditsStatuses,
      jsonBody(reorderStatusesInput),
      async (c) =>
        c.json(
          await reorderStatuses(userContext(ctx, c), c.req.param('key'), c.req.valid('json').ids),
        ),
    )
    .patch('/statuses/:id', personEditsStatuses, jsonBody(updateStatusInput), async (c) =>
      c.json(await updateStatus(userContext(ctx, c), c.req.param('id'), c.req.valid('json'))),
    )
    .delete('/statuses/:id', personEditsStatuses, queryParams(deleteStatusQuery), async (c) => {
      const { moveTo } = c.req.valid('query');
      await deleteStatus(userContext(ctx, c), c.get('actor'), c.req.param('id'), moveTo);
      return c.body(null, 204);
    });
