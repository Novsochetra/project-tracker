import { askInput, cardTicketInput, queuedEditInput, startChatInput } from '@tracker/shared';
import { Hono, type Context } from 'hono';
import { requireScope } from '../../auth/scope';
import { askInChat, getChat, listChats, startChat } from '../../services/chats';
import { deleteChat } from '../../services/chatDeletion';
import { editQueued, removeQueued, sendQueuedNow } from '../../services/chatQueue/queuedActions';
import { createCardTicket } from '../../services/chatTickets';
import type { ServiceContext } from '../../services/context';
import type { AppEnv } from '../env';
import { personDeletesChats, personOnly } from '../personOnly';
import { jsonBody } from '../validation';

const scope = (context: Context<AppEnv>) => requireScope(context.get('access'));
const queuedRef = (context: Context<AppEnv>) => ({
  chatId: context.req.param('id') ?? '',
  messageId: context.req.param('messageId') ?? '',
});

export const chatRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>()
    .get('/projects/:key/chats', async (context) =>
      context.json(await listChats(ctx, scope(context), context.req.param('key'))),
    )
    .post('/projects/:key/chats', personOnly, jsonBody(startChatInput), async (context) =>
      context.json(
        await startChat(ctx, scope(context), context.req.param('key'), context.req.valid('json')),
        201,
      ),
    )
    .get('/chats/:id', async (context) =>
      context.json(await getChat(ctx, scope(context), context.req.param('id'))),
    )
    .delete('/chats/:id', personDeletesChats, async (context) => {
      await deleteChat(ctx, scope(context), context.req.param('id'));

      return context.body(null, 204);
    })
    .post('/chats/:id/messages', personOnly, jsonBody(askInput), async (context) =>
      context.json(
        await askInChat(ctx, scope(context), context.req.param('id'), context.req.valid('json')),
      ),
    )
    .patch('/chats/:id/queue/:messageId', personOnly, jsonBody(queuedEditInput), async (context) =>
      context.json(
        await editQueued(ctx, scope(context), queuedRef(context), context.req.valid('json').text),
      ),
    )
    .delete('/chats/:id/queue/:messageId', personOnly, async (context) =>
      context.json(await removeQueued(ctx, scope(context), queuedRef(context))),
    )
    .post('/chats/:id/queue/:messageId/send', personOnly, async (context) =>
      context.json(await sendQueuedNow(ctx, scope(context), queuedRef(context))),
    )
    .post(
      '/chats/:id/messages/:messageId/ticket',
      personOnly,
      jsonBody(cardTicketInput),
      async (context) => {
        const person = { scope: scope(context), actor: context.get('actor') };
        const ref = { chatId: context.req.param('id'), messageId: context.req.param('messageId') };

        return context.json(await createCardTicket(ctx, person, ref, context.req.valid('json')));
      },
    );
