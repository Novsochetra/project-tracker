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
    .post(
      '/projects/:key/statuses',
      personEditsStatuses,
      jsonBody(createStatusInput),
      async (context) =>
        context.json(
          await createStatus(
            userContext(ctx, context),
            context.req.param('key'),
            context.req.valid('json'),
          ),
          201,
        ),
    )
    .put(
      '/projects/:key/statuses/order',
      personEditsStatuses,
      jsonBody(reorderStatusesInput),
      async (context) =>
        context.json(
          await reorderStatuses(
            userContext(ctx, context),
            context.req.param('key'),
            context.req.valid('json').ids,
          ),
        ),
    )
    .patch('/statuses/:id', personEditsStatuses, jsonBody(updateStatusInput), async (context) =>
      context.json(
        await updateStatus(
          userContext(ctx, context),
          context.req.param('id'),
          context.req.valid('json'),
        ),
      ),
    )
    .delete(
      '/statuses/:id',
      personEditsStatuses,
      queryParams(deleteStatusQuery),
      async (context) => {
        const { moveTo } = context.req.valid('query');
        await deleteStatus(
          userContext(ctx, context),
          context.get('actor'),
          context.req.param('id'),
          moveTo,
        );

        return context.body(null, 204);
      },
    );
