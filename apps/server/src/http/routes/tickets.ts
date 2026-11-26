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
import { personDeletesTickets } from '../personOnly';
import { userContext } from '../userContext';
import { jsonBody, queryParams } from '../validation';

export const ticketRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>()
    .get('/tickets', queryParams(listTicketsQuery), async (context) =>
      context.json(await listAllTickets(userContext(ctx, context), context.req.valid('query'))),
    )
    .get('/projects/:key/tickets', queryParams(listTicketsQuery), async (context) =>
      context.json(
        await listTickets(
          userContext(ctx, context),
          context.req.param('key'),
          context.req.valid('query'),
        ),
      ),
    )
    .post('/projects/:key/tickets', jsonBody(createTicketInput), async (context) =>
      context.json(
        await createTicket(
          userContext(ctx, context),
          context.get('actor'),
          context.req.param('key'),
          context.req.valid('json'),
        ),
        201,
      ),
    )
    .get('/tickets/:key', async (context) =>
      context.json(await getTicketDetail(userContext(ctx, context), context.req.param('key'))),
    )
    .patch('/tickets/:key', jsonBody(updateTicketRequest), async (context) => {
      const { expected, ...input } = context.req.valid('json');
      const update = {
        actor: context.get('actor'),
        key: context.req.param('key'),
        input,
        expected,
      };

      return context.json(await updateTicket(userContext(ctx, context), update));
    })
    .delete('/tickets/:key', personDeletesTickets, async (context) => {
      await deleteTicket(userContext(ctx, context), context.req.param('key'));

      return context.body(null, 204);
    })
    .post('/tickets/:key/move', jsonBody(moveTicketInput), async (context) =>
      context.json(
        await moveTicket(
          userContext(ctx, context),
          context.get('actor'),
          context.req.param('key'),
          context.req.valid('json'),
        ),
      ),
    )
    .get('/tickets/:key/prompt', async (context) =>
      context.json(await ticketPrompt(userContext(ctx, context), context.req.param('key'))),
    )
    .post('/tickets/:key/sent', jsonBody(markSentInput), async (context) =>
      context.json(
        await markSent(
          userContext(ctx, context),
          context.get('actor'),
          context.req.param('key'),
          context.req.valid('json'),
        ),
      ),
    );
