import { createLabelInput, reorderLabelsInput, updateLabelInput } from '@tracker/shared';
import { Hono } from 'hono';
import type { ServiceContext } from '../../services/context';
import { createLabel, deleteLabel, reorderLabels, updateLabel } from '../../services/labels';
import type { AppEnv } from '../env';
import { personEditsLabels } from '../personOnly';
import { userContext } from '../userContext';
import { jsonBody } from '../validation';

export const labelRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>()
    .post('/projects/:key/labels', personEditsLabels, jsonBody(createLabelInput), async (context) =>
      context.json(
        await createLabel(
          userContext(ctx, context),
          context.req.param('key'),
          context.req.valid('json'),
        ),
        201,
      ),
    )
    .put(
      '/projects/:key/labels/order',
      personEditsLabels,
      jsonBody(reorderLabelsInput),
      async (context) =>
        context.json(
          await reorderLabels(
            userContext(ctx, context),
            context.req.param('key'),
            context.req.valid('json').ids,
          ),
        ),
    )
    .patch('/labels/:id', personEditsLabels, jsonBody(updateLabelInput), async (context) =>
      context.json(
        await updateLabel(
          userContext(ctx, context),
          context.req.param('id'),
          context.req.valid('json'),
        ),
      ),
    )
    .delete('/labels/:id', personEditsLabels, async (context) => {
      await deleteLabel(userContext(ctx, context), context.req.param('id'));

      return context.body(null, 204);
    });
