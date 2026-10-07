import { createCommentInput, updateCommentInput } from '@tracker/shared';
import { Hono } from 'hono';
import { addComment, deleteActivity, updateComment } from '../../services/comments';
import type { ServiceContext } from '../../services/context';
import type { AppEnv } from '../env';
import { jsonBody } from '../validation';

export const activityRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>()
    .post('/tickets/:key/comments', jsonBody(createCommentInput), async (c) =>
      c.json(await addComment(ctx, c.get('actor'), c.req.param('key'), c.req.valid('json')), 201),
    )
    .patch('/activity/:id', jsonBody(updateCommentInput), async (c) =>
      c.json(await updateComment(ctx, c.req.param('id'), c.req.valid('json'))),
    )
    .delete('/activity/:id', async (c) => {
      await deleteActivity(ctx, c.req.param('id'));
      return c.body(null, 204);
    });
