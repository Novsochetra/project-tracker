import { runAllCardInput, runAllInput } from '@tracker/shared';
import { Hono, type Context } from 'hono';
import { requireScope } from '../../auth/scope';
import { previewRunAll, runAllTodo } from '../../services/batchRuns';
import { getRunBatch } from '../../services/batchView';
import { runAllFromCard } from '../../services/chatRunAll';
import type { ServiceContext } from '../../services/context';
import type { AppEnv } from '../env';
import { personOnly } from '../personOnly';
import { jsonBody } from '../validation';

const scope = (context: Context<AppEnv>) => requireScope(context.get('access'));

export const batchRunRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>()
    .get('/projects/:key/run-all', async (context) =>
      context.json(await previewRunAll(ctx, scope(context), context.req.param('key'))),
    )
    .post('/projects/:key/run-all', personOnly, jsonBody(runAllInput), async (context) =>
      context.json(
        await runAllTodo(ctx, scope(context), {
          projectKey: context.req.param('key'),
          input: context.req.valid('json'),
        }),
        201,
      ),
    )
    .post(
      '/chats/:id/messages/:messageId/run-all',
      personOnly,
      jsonBody(runAllCardInput),
      async (context) => {
        const ref = { chatId: context.req.param('id'), messageId: context.req.param('messageId') };

        return context.json(
          await runAllFromCard(ctx, scope(context), ref, context.req.valid('json')),
          201,
        );
      },
    )
    .get('/runs/:id/batch', async (context) =>
      context.json(await getRunBatch(ctx, scope(context), context.req.param('id'))),
    );
