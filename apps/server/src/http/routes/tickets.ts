import {
  createTicketInput,
  listTicketsQuery,
  markSentInput,
  moveTicketInput,
  updateTicketInput,
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
import { getTicketDetail, listTickets } from '../../services/ticketQueries';
import { markSent } from '../../services/workflow';
import type { AppEnv } from '../env';
import { jsonBody, queryParams } from '../validation';

export const ticketRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>()
    .get('/projects/:key/tickets', queryParams(listTicketsQuery), async (c) =>
      c.json(await listTickets(ctx, c.req.param('key'), c.req.valid('query'))),
    )
    .post('/projects/:key/tickets', jsonBody(createTicketInput), async (c) =>
      c.json(await createTicket(ctx, c.get('actor'), c.req.param('key'), c.req.valid('json')), 201),
    )
    .get('/tickets/:key', async (c) => c.json(await getTicketDetail(ctx, c.req.param('key'))))
    .patch('/tickets/:key', jsonBody(updateTicketInput), async (c) =>
      c.json(await updateTicket(ctx, c.get('actor'), c.req.param('key'), c.req.valid('json'))),
    )
    .delete('/tickets/:key', async (c) => {
      await deleteTicket(ctx, c.req.param('key'));
      return c.body(null, 204);
    })
    .post('/tickets/:key/move', jsonBody(moveTicketInput), async (c) =>
      c.json(await moveTicket(ctx, c.get('actor'), c.req.param('key'), c.req.valid('json'))),
    )
    .get('/tickets/:key/prompt', async (c) => c.json(await ticketPrompt(ctx, c.req.param('key'))))
    .post('/tickets/:key/sent', jsonBody(markSentInput), async (c) =>
      c.json(await markSent(ctx, c.get('actor'), c.req.param('key'), c.req.valid('json'))),
    );
