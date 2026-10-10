import { createMiddleware } from 'hono/factory';
import { forbidden } from '../errors';
import type { AppEnv } from './env';

// Checked before the body, like the other refusals.
const refuseAgents = (message: string) =>
  createMiddleware<AppEnv>(async (c, next) => {
    if (c.get('actor').kind !== 'human') throw forbidden(message);
    await next();
  });

// So agents can't start more agents.
export const personOnly = refuseAgents(
  "Only a person can start Claude Code. Agents can't start more agents.",
);

// Steps are for the person watching from the phone; an agent has the tracker's own tools.
export const personReadsSteps = refuseAgents('Only a person reads what Claude did in a run.');
