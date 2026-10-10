import { createMiddleware } from 'hono/factory';
import { forbidden } from '../errors';
import type { AppEnv } from './env';

// The helper signs in with an API token; on a tracker without an owner it needs none.
export const helperOnly = createMiddleware<AppEnv>(async (c, next) => {
  const kind = c.get('access')?.kind;
  if (kind !== 'token' && kind !== 'open') {
    throw forbidden('Only tracker watch does this, with an API token from Connect Claude Code.');
  }
  await next();
});
