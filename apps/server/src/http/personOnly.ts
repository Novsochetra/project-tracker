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

// Requests are for the person answering on the phone; the helper that asked waits on each by id.
export const personReadsRequests = refuseAgents('Only a person reads what Claude asks.');

// Only the person decides what Claude may do; an agent could otherwise allow itself anything.
export const personAnswers = refuseAgents('Only a person answers what Claude asks.');

// A chat is the person's own conversation with Claude; an agent never removes one.
export const personDeletesChats = refuseAgents('Only a person deletes a chat.');

// Notifications are for a person's own phone; an agent's token has no device to send them to.
export const personPushes = refuseAgents('Only a person turns on notifications.');

// A project's repo and instructions go into every prompt, so an agent could rewrite what later runs are told.
export const personEditsProjects = refuseAgents('Only a person changes or deletes a project.');

// A label's instructions go into the prompts of its tickets, so an agent could rewrite what later
// runs are told. Agents still put labels on tickets.
export const personEditsLabels = refuseAgents('Only a person changes labels.');
