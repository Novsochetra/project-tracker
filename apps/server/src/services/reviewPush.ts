import { reviewedPush, type Actor, type PushMessage } from '@tracker/shared';
import type { StatusRow } from '../db/schema';
import type { TicketScope } from './lookups';

// Only an agent's review tells the person anything: their own they just made.
export function readyPush(
  actor: Actor,
  scope: TicketScope,
  review: { target: StatusRow; rating: number },
): PushMessage | null {
  if (actor.kind !== 'agent' || review.target.category !== 'reviewed') return null;
  const { project, ticket } = scope;
  return reviewedPush(
    { projectKey: project.key, num: ticket.num, title: ticket.title },
    review.rating,
  );
}
