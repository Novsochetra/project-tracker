import {
  createTicketInput,
  listTicketsQuery,
  markSentInput,
  moveTicketInput,
  updateTicketRequest,
} from '@tracker/shared';
import { Hono } from 'hono';
import type { ServiceContext } from '../../services/context';
import { ticketPrompt } from '../../services/prompts';
import {
  createTicket,
  deleteTicket,
  moveTicket,
  updateTicket,
} from '../../services/ticketCommands';
import { getTicketDetail, listAllTickets, listTickets } from '../../services/ticketQueries';
import { markSent } from '../../services/workflow';
import type { AppEnv } from '../env';
import { userContext } from '../userContext';
import { jsonBody, queryParams } from '../validation';

export const ticketRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>()
    .get('/tickets', queryParams(listTicketsQuery), async (c) =>
      c.json(await listAllTickets(userContext(ctx, c), c.req.valid('query'))),
    )
    .get('/projects/:key/tickets', queryParams(listTicketsQuery), async (c) =>
      c.json(await listTickets(userContext(ctx, c), c.req.param('key'), c.req.valid('query'))),
    )
    .post('/projects/:key/tickets', jsonBody(createTicketInput), async (c) =>
      c.json(
        await createTicket(
          userContext(ctx, c),
          c.get('actor'),
          c.req.param('key'),
          c.req.valid('json'),
        ),
        201,
      ),
    )
    .get('/tickets/:key', async (c) =>
      c.json(await getTicketDetail(userContext(ctx, c), c.req.param('key'))),
    )
    .patch('/tickets/:key', jsonBody(updateTicketRequest), async (c) => {
      const { expected, ...input } = c.req.valid('json');
      const update = { actor: c.get('actor'), key: c.req.param('key'), input, expected };
      return c.json(await updateTicket(userContext(ctx, c), update));
    })
    .delete('/tickets/:key', async (c) => {
      await deleteTicket(userContext(ctx, c), c.req.param('key'));
      return c.body(null, 204);
    })
    .post('/tickets/:key/move', jsonBody(moveTicketInput), async (c) =>
      c.json(
        await moveTicket(
          userContext(ctx, c),
          c.get('actor'),
          c.req.param('key'),
          c.req.valid('json'),
        ),
      ),
    )
    .get('/tickets/:key/prompt', async (c) =>
      c.json(await ticketPrompt(userContext(ctx, c), c.req.param('key'))),
    )
    .post('/tickets/:key/sent', jsonBody(markSentInput), async (c) =>
      c.json(
        await markSent(
          userContext(ctx, c),
          c.get('actor'),
          c.req.param('key'),
          c.req.valid('json'),
        ),
      ),
    );
