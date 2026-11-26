import { searchQuery } from '@tracker/shared';
import { Hono } from 'hono';
import type { ServiceContext } from '../../services/context';
import { searchTickets } from '../../services/search';
import type { AppEnv } from '../env';
import { userContext } from '../userContext';
import { queryParams } from '../validation';

export const searchRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>().get('/search', queryParams(searchQuery), async (c) =>
    c.json(await searchTickets(userContext(ctx, c), c.req.valid('query'))),
  );
