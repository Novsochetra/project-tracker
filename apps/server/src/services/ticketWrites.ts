import { randomUUID } from 'node:crypto';
import {
  isDoneCategory,
  topRank,
  type ActivityType,
  type Actor,
  type Review,
} from '@tracker/shared';
import type { Clock } from '../clock';
import type { ActivityRow, Db, StatusRow, TicketRow } from '../db/schema';
import { conflict, forbidden, staleEdit } from '../errors';
import { insertActivity } from '../repositories/activities';
import {
  listGroupRanks,
  updateTicketMatching,
  updateTicketRow,
  type TicketChanges,
  type TicketMatch,
} from '../repositories/tickets';
import { isEmpty } from '../util';

export interface ActivityEntry {
  type: ActivityType;
  text: string;
  review?: Review;
}

export interface NewActivity extends ActivityEntry {
  ticketId: string;
  actor: Actor;
  at: number;
}

export const eventEntry = (text: string): ActivityEntry => ({ type: 'event', text });

export function activityRow(input: NewActivity): ActivityRow {
  return {
    id: randomUUID(),
    ticketId: input.ticketId,
    type: input.type,
    actorKind: input.actor.kind,
    actorName: input.actor.name,
    text: input.text,
    reviewVerdict: input.review?.verdict ?? null,
    reviewRating: input.review?.rating ?? null,
    createdAt: input.at,
    editedAt: null,
  };
}

export function assertMayEnter(actor: Actor, status: StatusRow): void {
  if (actor.kind === 'agent' && isDoneCategory(status.category)) {
    throw forbidden('Only a person can move tickets to Done.');
  }
}

// Every status change except a drag or keyboard move lands at the top of the new group (SPEC §6.2).
export async function enterStatus(
  db: Db,
  actor: Actor,
  status: StatusRow,
): Promise<Pick<TicketRow, 'statusId' | 'rank'>> {
  assertMayEnter(actor, status);

  return { statusId: status.id, rank: topRank(await listGroupRanks(db, status.id)) };
}

export interface TicketWrite {
  ticket: TicketRow;
  actor: Actor;
  changes?: TicketChanges;
  entries?: readonly ActivityEntry[];
  // Holds the write to the status it was read in, for a person too: a claim, a bulk move to Done.
  guardStatus?: boolean;
  // Field values the edit was typed over (expectedMatch).
  match?: TicketMatch;
}

// On Postgres another commit can land between this transaction's read and its write (§2). So an
// agent's write that sets the status must still find the status it was read in, which the rules
// about Done were checked against, and an edit the text it was typed over. A person's own move
// wins as before: their quick keyboard moves overlap, and must not refuse each other.
async function saveChanges(db: Db, write: TicketWrite, changes: TicketChanges): Promise<void> {
  const agentMoves = write.actor.kind === 'agent' && changes.statusId !== undefined;
  const inStatus = write.guardStatus === true || agentMoves;
  const match = inStatus ? { ...write.match, statusId: write.ticket.statusId } : write.match;
  if (!match) return updateTicketRow(db, write.ticket.id, changes);
  if (await updateTicketMatching(db, write.ticket.id, match, changes)) return;

  throw inStatus && isEmpty(write.match ?? {})
    ? conflict('Someone else changed this ticket at the same time. Try again.')
    : staleEdit();
}

export interface WrittenTicket {
  ticket: TicketRow;
  activities: ActivityRow[];
}

export async function writeTicket(
  db: Db,
  clock: Clock,
  write: TicketWrite,
): Promise<WrittenTicket> {
  const entries = write.entries ?? [];
  const at = clock(entries.length);
  const changes = { ...write.changes, updatedAt: at };
  await saveChanges(db, write, changes);
  const activities = entries.map((entry, index) =>
    activityRow({ ...entry, ticketId: write.ticket.id, actor: write.actor, at: at + index }),
  );
  for (const row of activities) await insertActivity(db, row);

  return { ticket: { ...write.ticket, ...changes }, activities };
}
