import type { Context } from 'hono';
import { requireScope } from '../auth/scope';
import { forUser, type ServiceContext, type UserContext } from '../services/context';
import type { AppEnv } from './env';

export const userContext = (ctx: ServiceContext, c: Context<AppEnv>): UserContext =>
  forUser(ctx, requireScope(c.get('access')));
