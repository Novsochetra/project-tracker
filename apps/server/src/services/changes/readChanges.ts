import {
  parseDiff,
  type TicketChanges,
  type TicketChangesAnswer,
  type ViewedFileInput,
} from '@tracker/shared';
import type { Db, TicketRow } from '../../db/schema';
import { notFound } from '../../errors';
import type { RunChangesRow, ViewedFileRow } from '../../db/changeTables';
import { latestTicketChanges } from '../../repositories/runChanges';
import { listViewedFiles, markFileViewed, unmarkFileViewed } from '../../repositories/viewedFiles';
import { notify, type UserContext } from '../context';
import { requireTicket } from '../lookups';

const toChanges = (row: RunChangesRow, viewed: readonly ViewedFileRow[]): TicketChanges => ({
  runId: row.runId,
  diff: row.diff,
  cut: row.cut === 1,
  createdAt: row.createdAt,
  verdict: row.verdict,
  viewed: Object.fromEntries(viewed.map((file) => [file.path, file.digest])),
});

export async function readTicketChanges(
  ctx: UserContext,
  key: string,
): Promise<TicketChangesAnswer> {
  const { ticket } = await requireTicket(ctx.db, ctx.scope, key);
  const row = await latestTicketChanges(ctx.db, ticket.id);
  if (!row) return { changes: null };
  return { changes: toChanges(row, await listViewedFiles(ctx.db, ticket.id)) };
}

// Only a file of the latest changes takes a tick, so ticks can't pile up for paths that never were.
async function requireChangedFile(db: Db, ticket: TicketRow, path: string): Promise<void> {
  const latest = await latestTicketChanges(db, ticket.id);
  if (!latest || !parseDiff(latest.diff).some((file) => file.path === path)) {
    throw notFound("That file isn't in this ticket's changes.");
  }
}

export async function setFileViewed(
  ctx: UserContext,
  key: string,
  input: ViewedFileInput,
): Promise<void> {
  const { ticket, project } = await requireTicket(ctx.db, ctx.scope, key);
  if (input.viewed) {
    await requireChangedFile(ctx.db, ticket, input.path);
    const row = { ticketId: ticket.id, path: input.path, digest: input.digest };
    await markFileViewed(ctx.db, { ...row, createdAt: ctx.now() });
  } else {
    await unmarkFileViewed(ctx.db, ticket.id, input.path);
  }
  notify(ctx, project.id, ticket.id);
}
