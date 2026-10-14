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

// A project's instructions go into every prompt, so an agent could set what later runs are told.
export const personCreatesProjects = refuseAgents('Only a person creates a project.');

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

// A status's category decides what counts as done and its name goes into prompts.
export const personEditsStatuses = refuseAgents("Only a person changes a project's statuses.");

// A label's instructions go into the prompts of its tickets, so an agent could rewrite what later
// runs are told. Agents still put labels on tickets.
export const personEditsLabels = refuseAgents('Only a person changes labels.');

// Approve and Ask for changes decide where the ticket goes, so an agent can't approve its own work.
export const personReviewsChanges = refuseAgents('Only a person reviews the changes.');

// A commit or a pull request puts code in the repository and on GitHub under the person's name, so
// an agent can't commit or push its own work.
export const personCommits = refuseAgents('Only a person commits or opens a pull request.');
