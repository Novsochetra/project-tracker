import { createMiddleware } from 'hono/factory';
import { forbidden } from '../errors';
import type { AppEnv } from './env';

// So agents can't start more agents. Checked before the body, like the other refusals.
export const personOnly = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get('actor').kind !== 'human') {
    throw forbidden("Only a person can start Claude Code. Agents can't start more agents.");
  }
  await next();
});
