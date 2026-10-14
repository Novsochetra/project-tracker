import { randomUUID } from 'node:crypto';
import {
  isDoneCategory,
  topRank,
  type ActivityType,
  type Actor,
  type LineRef,
  type Review,
} from '@tracker/shared';
import type { Clock } from '../clock';
import type { ActivityRow, Db, StatusRow, TicketRow } from '../db/schema';
import { conflict, forbidden, staleEdit } from '../errors';
import { insertActivity } from '../repositories/activities';
import { advanceBatchTicket } from '../repositories/batchRuns';
import { findStatusById } from '../repositories/statuses';
import {
  listGroupRanks,
  updateTicketInStatus,
  updateTicketMatching,
  updateTicketRow,
  type TicketChanges,
  type TicketMatch,
} from '../repositories/tickets';

export interface ActivityEntry {
  type: ActivityType;
  text: string;
  review?: Review;
  line?: LineRef;
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
    lineRunId: input.line?.runId ?? null,
    linePath: input.line?.path ?? null,
    lineSide: input.line?.side ?? null,
    lineNumber: input.line?.line ?? null,
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
  guardStatus?: boolean;
  // Field values the edit was typed over (expectedMatch).
  match?: TicketMatch;
}

async function saveChanges(db: Db, write: TicketWrite, changes: TicketChanges): Promise<void> {
  if (write.match) {
    if (!(await updateTicketMatching(db, write.ticket.id, write.match, changes))) throw staleEdit();
    return;
  }
  if (!write.guardStatus) return updateTicketRow(db, write.ticket.id, changes);
  const saved = await updateTicketInStatus(db, write.ticket.id, write.ticket.statusId, changes);
  if (!saved) throw conflict('Someone else changed this ticket at the same time. Try again.');
}

// Every status change passes here, a person's drag as much as a sub agent's claim or submit.
async function followStatus(db: Db, write: TicketWrite, changes: TicketChanges, at: number) {
  if (!changes.statusId || changes.statusId === write.ticket.statusId) return;
  const status = await findStatusById(db, changes.statusId);
  if (status) await advanceBatchTicket(db, write.ticket.id, status.category, at);
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
  await followStatus(db, write, changes, at);
  const activities = entries.map((entry, index) =>
    activityRow({ ...entry, ticketId: write.ticket.id, actor: write.actor, at: at + index }),
  );
  for (const row of activities) await insertActivity(db, row);
  return { ticket: { ...write.ticket, ...changes }, activities };
}
