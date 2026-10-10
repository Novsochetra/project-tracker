import { askInput, cardTicketInput } from '@tracker/shared';
import { Hono, type Context } from 'hono';
import { requireScope } from '../../auth/scope';
import { askInChat, getChat, listChats, startChat } from '../../services/chats';
import { createCardTicket } from '../../services/chatTickets';
import type { ServiceContext } from '../../services/context';
import type { AppEnv } from '../env';
import { personOnly } from '../personOnly';
import { jsonBody } from '../validation';

const scope = (c: Context<AppEnv>) => requireScope(c.get('access'));

export const chatRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>()
    .get('/projects/:key/chats', async (c) =>
      c.json(await listChats(ctx, scope(c), c.req.param('key'))),
    )
    .post('/projects/:key/chats', personOnly, jsonBody(askInput), async (c) =>
      c.json(await startChat(ctx, scope(c), c.req.param('key'), c.req.valid('json')), 201),
    )
    .get('/chats/:id', async (c) => c.json(await getChat(ctx, scope(c), c.req.param('id'))))
    .post('/chats/:id/messages', personOnly, jsonBody(askInput), async (c) =>
      c.json(await askInChat(ctx, scope(c), c.req.param('id'), c.req.valid('json'))),
    )
    .post(
      '/chats/:id/messages/:messageId/ticket',
      personOnly,
      jsonBody(cardTicketInput),
      async (c) => {
        const person = { scope: scope(c), actor: c.get('actor') };
        const ref = { chatId: c.req.param('id'), messageId: c.req.param('messageId') };
        return c.json(await createCardTicket(ctx, person, ref, c.req.valid('json')));
      },
    );
