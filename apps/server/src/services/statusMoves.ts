import { RANK_STEP, byRank, type Actor } from '@tracker/shared';
import type { Clock } from '../clock';
import type { Db, StatusRow } from '../db/schema';
import { listGroupRanks, listTicketsInStatus } from '../repositories/tickets';
import { statusChangedText } from './statusEvents';
import { assertMayEnter, eventEntry, writeTicket } from './ticketWrites';

export interface GroupMove {
  from: StatusRow;
  // Only asked when the group has tickets, so an empty status needs no target.
  to: () => StatusRow;
}

async function endRank(db: Db, statusId: string): Promise<number> {
  const group = await listGroupRanks(db, statusId);
  return group.length === 0 ? 0 : Math.max(...group.map((ticket) => ticket.rank)) + RANK_STEP;
}

export async function moveGroupToEnd(
  db: Db,
  clock: Clock,
  actor: Actor,
  move: GroupMove,
): Promise<void> {
  const tickets = (await listTicketsInStatus(db, move.from.id)).sort(byRank);
  if (tickets.length === 0) return;
  const target = move.to();
  assertMayEnter(actor, target);
  const start = await endRank(db, target.id);
  for (const [index, ticket] of tickets.entries()) {
    await writeTicket(db, clock, {
      ticket,
      actor,
      changes: { statusId: target.id, rank: start + index * RANK_STEP },
      entries: [eventEntry(statusChangedText(target.name))],
    });
  }
}
