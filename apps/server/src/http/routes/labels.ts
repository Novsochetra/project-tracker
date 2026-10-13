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
    .post('/projects/:key/labels', personEditsLabels, jsonBody(createLabelInput), async (c) =>
      c.json(await createLabel(userContext(ctx, c), c.req.param('key'), c.req.valid('json')), 201),
    )
    .put(
      '/projects/:key/labels/order',
      personEditsLabels,
      jsonBody(reorderLabelsInput),
      async (c) =>
        c.json(
          await reorderLabels(userContext(ctx, c), c.req.param('key'), c.req.valid('json').ids),
        ),
    )
    .patch('/labels/:id', personEditsLabels, jsonBody(updateLabelInput), async (c) =>
      c.json(await updateLabel(userContext(ctx, c), c.req.param('id'), c.req.valid('json'))),
    )
    .delete('/labels/:id', personEditsLabels, async (c) => {
      await deleteLabel(userContext(ctx, c), c.req.param('id'));
      return c.body(null, 204);
    });
