import {
  byRank,
  findStatusByCategory,
  formatTicketKey,
  isDoneCategory,
  topRanks,
  type Actor,
  type MovedTicket,
  type TicketMoves,
  type TicketPlaceInput,
} from '@tracker/shared';
import type { Db, StatusRow, TicketRow } from '../db/schema';
import { listGroupRanks } from '../repositories/tickets';
import { inTransaction, notify, type UserContext } from './context';
import { findNamedTickets, nameTickets, type ProjectTickets } from './namedTickets';
import { statusChangedText } from './statusEvents';
import { eventEntry, writeTicket } from './ticketWrites';

interface Placement {
  ticket: TicketRow;
  projectKey: string;
  status: StatusRow;
  rank: number;
}

interface ProjectMoves {
  projectId: string;
  moved: MovedTicket[];
}

// Written as a move from the status menu writes it, so the activity reads the same. Only while the
// ticket is still in the status it was read in: on Postgres, one someone moved meanwhile refuses
// the whole request (409) rather than being moved again on top of that.
async function place(
  trx: Db,
  ctx: UserContext,
  actor: Actor,
  placement: Placement,
): Promise<MovedTicket> {
  const { ticket, status, rank } = placement;
  await writeTicket(trx, ctx.now, {
    ticket,
    actor,
    changes: { statusId: status.id, rank },
    entries: [eventEntry(statusChangedText(status.name))],
    guardStatus: true,
  });

  return {
    key: formatTicketKey(placement.projectKey, ticket.num),
    from: { statusId: ticket.statusId, rank: ticket.rank },
  };
}

const isDoneIn = (statuses: readonly StatusRow[], statusId: string): boolean =>
  statuses.some((status) => status.id === statusId && isDoneCategory(status.category));

// They reach the top of Done in the order they stood in, as one ticket moved there alone would.
async function moveProjectToDone(
  trx: Db,
  ctx: UserContext,
  actor: Actor,
  group: ProjectTickets,
): Promise<ProjectMoves> {
  const { project, statuses, tickets } = group;
  const done = findStatusByCategory(statuses, 'done');
  const leaving = tickets.filter((ticket) => !isDoneIn(statuses, ticket.statusId)).sort(byRank);
  if (!done || leaving.length === 0) return { projectId: project.id, moved: [] };

  const ranks = topRanks(
    await listGroupRanks(trx, done.id),
    leaving.map((ticket) => ticket.id),
  );
  const moved: MovedTicket[] = [];
  for (const ticket of leaving) {
    const rank = ranks.get(ticket.id) ?? ticket.rank;
    moved.push(
      await place(trx, ctx, actor, { ticket, projectKey: project.key, status: done, rank }),
    );
  }

  return { projectId: project.id, moved };
}

// One event for the whole request: the project's when every ticket moved in one, otherwise the one
// that has each screen read again what it shows.
function announce(ctx: UserContext, results: readonly ProjectMoves[]): void {
  const changed = results.filter(({ moved }) => moved.length > 0);
  const [first, ...others] = new Set(changed.map(({ projectId }) => projectId));
  if (!first) return;

  notify(ctx, others.length === 0 ? first : null);
}

function answer(order: readonly string[], results: readonly ProjectMoves[]): TicketMoves {
  const byKey = new Map(results.flatMap(({ moved }) => moved.map((each) => [each.key, each])));

  return {
    moved: order.flatMap((key) => byKey.get(key) ?? []),
    skipped: order.filter((key) => !byKey.has(key)),
  };
}

// A ticket already in a done status, or in a project without one, stays where it is.
export async function moveToDone(
  ctx: UserContext,
  actor: Actor,
  keys: readonly string[],
): Promise<TicketMoves> {
  const tickets = nameTickets(keys, (key) => key);
  const results = await inTransaction(ctx, async (trx) => {
    const moves: ProjectMoves[] = [];
    for (const group of await findNamedTickets(trx, ctx.scope, tickets.named)) {
      moves.push(await moveProjectToDone(trx, ctx, actor, group));
    }

    return moves;
  });
  announce(ctx, results);

  return answer(tickets.order, results);
}

interface Found {
  ticket: TicketRow;
  group: ProjectTickets;
}

const byTicketKey = (groups: readonly ProjectTickets[]): Map<string, Found> =>
  new Map(
    groups.flatMap((group) =>
      group.tickets.map((ticket) => [
        formatTicketKey(group.project.key, ticket.num),
        { ticket, group },
      ]),
    ),
  );

// An undo only takes a ticket out of Done: one moved on since stays where someone put it.
function placeBack(found: Found | undefined, target: TicketPlaceInput): Placement | null {
  if (!found || !isDoneIn(found.group.statuses, found.ticket.statusId)) return null;

  const status = found.group.statuses.find((candidate) => candidate.id === target.statusId);
  if (!status || isDoneCategory(status.category)) return null;

  return { ticket: found.ticket, projectKey: found.group.project.key, status, rank: target.rank };
}

// One at a time in the order given, so the caller decides which ticket is updated last: Ready for
// you lists the latest first.
export async function undoMoveToDone(
  ctx: UserContext,
  actor: Actor,
  places: readonly TicketPlaceInput[],
): Promise<TicketMoves> {
  const tickets = nameTickets(places, (each) => each.key);
  const results = await inTransaction(ctx, async (trx) => {
    const found = byTicketKey(await findNamedTickets(trx, ctx.scope, tickets.named));
    const moves: ProjectMoves[] = [];
    for (const { key, value } of tickets.named) {
      const back = placeBack(found.get(key), value);
      if (!back) continue;

      moves.push({ projectId: back.ticket.projectId, moved: [await place(trx, ctx, actor, back)] });
    }

    return moves;
  });
  announce(ctx, results);

  return answer(tickets.order, results);
}
