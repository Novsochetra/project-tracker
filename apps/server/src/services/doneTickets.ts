import { isDoneCategory, type Actor } from '@tracker/shared';
import { forbidden } from '../errors';
import { ticketKeyOf, type TicketScope } from './lookups';

const REOPEN = 'reopen: true (--reopen in the CLI)';

const agentInDone = (actor: Actor, scope: TicketScope): boolean =>
  actor.kind === 'agent' && isDoneCategory(scope.status.category);

// The person put the ticket in Done, so an agent moves it out only when they tell it to, and says
// so with `reopen` (the owner's rule, PT-276).
export function assertMayLeave(actor: Actor, scope: TicketScope, reopen?: boolean): void {
  if (!agentInDone(actor, scope) || reopen) return;

  const { name } = scope.status;
  throw forbidden(
    `${ticketKeyOf(scope)} is in ${name}. Move it out of ${name} only when the person tells you ` +
      `to, and then pass ${REOPEN}.`,
  );
}

// A submit would move the ticket out of Done too, with no word that the person asked, so the agent
// reopens it first.
export function assertMaySubmit(actor: Actor, scope: TicketScope): void {
  if (!agentInDone(actor, scope)) return;

  const { name } = scope.status;
  throw forbidden(
    `${ticketKeyOf(scope)} is in ${name}. Submit work on it only when the person tells you to, ` +
      `after you move it out of ${name} with ${REOPEN}.`,
  );
}
