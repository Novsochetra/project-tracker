import { createMiddleware } from 'hono/factory';
import { forbidden } from '../errors';
import type { AppEnv } from './env';

// Checked before the body, like the other refusals.
const refuseAgents = (message: string) =>
  createMiddleware<AppEnv>(async (context, next) => {
    if (context.get('actor').kind !== 'human') throw forbidden(message);
    await next();
  });

// A project's instructions go into every ticket an agent reads, so an agent could set what later
// agents are told.
export const personCreatesProjects = refuseAgents('Only a person creates a project.');

// An agent could otherwise answer its own question.
export const personAnswers = refuseAgents('Only a person answers what Claude asks.');

// Notifications are for a person's own phone; an agent's token has no device to send them to.
export const personPushes = refuseAgents('Only a person turns on notifications.');

// A project's repo and instructions go into every ticket an agent reads, so an agent could rewrite
// what later agents are told.
export const personEditsProjects = refuseAgents('Only a person changes or deletes a project.');

// The order is how the person's own sidebar and Projects screen read; agents list projects as they are.
export const personOrdersProjects = refuseAgents('Only a person reorders projects.');

// A status's category decides what counts as done and its name goes into what agents read.
export const personEditsStatuses = refuseAgents("Only a person changes a project's statuses.");

// A label's instructions go into the tickets agents read, so an agent could rewrite what later
// agents are told. Agents still put labels on tickets.
export const personEditsLabels = refuseAgents('Only a person changes labels.');

// A delete can't be undone and takes the ticket's whole history with it, so an agent, or a prompt
// hidden in a ticket, could erase the person's work.
export const personDeletesTickets = refuseAgents('Only a person deletes a ticket.');

// Comments, reports and reviews are the ticket's record: an agent could rewrite what the person
// wrote or delete the review that judged its own work. Agents still add all three.
export const personEditsActivity = refuseAgents(
  'Only a person edits or deletes comments, reports and reviews.',
);
