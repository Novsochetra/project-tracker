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

const scope = (c: Context<AppEnv>) => requireScope(c.get('access'));

export const batchRunRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>()
    .get('/projects/:key/run-all', async (c) =>
      c.json(await previewRunAll(ctx, scope(c), c.req.param('key'))),
    )
    .post('/projects/:key/run-all', personOnly, jsonBody(runAllInput), async (c) =>
      c.json(
        await runAllTodo(ctx, scope(c), {
          projectKey: c.req.param('key'),
          input: c.req.valid('json'),
        }),
        201,
      ),
    )
    .post(
      '/chats/:id/messages/:messageId/run-all',
      personOnly,
      jsonBody(runAllCardInput),
      async (c) => {
        const ref = { chatId: c.req.param('id'), messageId: c.req.param('messageId') };
        return c.json(await runAllFromCard(ctx, scope(c), ref, c.req.valid('json')), 201);
      },
    )
    .get('/runs/:id/batch', async (c) =>
      c.json(await getRunBatch(ctx, scope(c), c.req.param('id'))),
    );
