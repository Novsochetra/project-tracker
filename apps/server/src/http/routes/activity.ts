import { createCommentInput, updateCommentRequest } from '@tracker/shared';
import { Hono } from 'hono';
import { addComment, deleteActivity, updateComment } from '../../services/comments';
import type { ServiceContext } from '../../services/context';
import type { AppEnv } from '../env';
import { userContext } from '../userContext';
import { jsonBody } from '../validation';

export const activityRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>()
    .post('/tickets/:key/comments', jsonBody(createCommentInput), async (c) =>
      c.json(
        await addComment(
          userContext(ctx, c),
          c.get('actor'),
          c.req.param('key'),
          c.req.valid('json'),
        ),
        201,
      ),
    )
    .patch('/activity/:id', jsonBody(updateCommentRequest), async (c) =>
      c.json(await updateComment(userContext(ctx, c), c.req.param('id'), c.req.valid('json'))),
    )
    .delete('/activity/:id', async (c) => {
      await deleteActivity(userContext(ctx, c), c.req.param('id'));
      return c.body(null, 204);
    });
