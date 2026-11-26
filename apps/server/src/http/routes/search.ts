import { searchQuery } from '@tracker/shared';
import { Hono } from 'hono';
import type { ServiceContext } from '../../services/context';
import { searchTickets } from '../../services/search';
import type { AppEnv } from '../env';
import { userContext } from '../userContext';
import { queryParams } from '../validation';

export const searchRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>().get('/search', queryParams(searchQuery), async (context) =>
    context.json(await searchTickets(userContext(ctx, context), context.req.valid('query'))),
  );
