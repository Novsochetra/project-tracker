import { createCommentInput, updateCommentRequest } from '@tracker/shared';
import { Hono } from 'hono';
import { addComment, deleteActivity, updateComment } from '../../services/comments';
import type { ServiceContext } from '../../services/context';
import type { AppEnv } from '../env';
import { personEditsActivity } from '../personOnly';
import { userContext } from '../userContext';
import { jsonBody } from '../validation';

export const activityRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>()
    .post('/tickets/:key/comments', jsonBody(createCommentInput), async (context) =>
      context.json(
        await addComment(
          userContext(ctx, context),
          context.get('actor'),
          context.req.param('key'),
          context.req.valid('json'),
        ),
        201,
      ),
    )
    .patch('/activity/:id', personEditsActivity, jsonBody(updateCommentRequest), async (context) =>
      context.json(
        await updateComment(
          userContext(ctx, context),
          context.req.param('id'),
          context.req.valid('json'),
        ),
      ),
    )
    .delete('/activity/:id', personEditsActivity, async (context) => {
      await deleteActivity(userContext(ctx, context), context.req.param('id'));

      return context.body(null, 204);
    });
