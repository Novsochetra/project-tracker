import {
  parseReport,
  parseTicketKey,
  reportMayMove,
  resolveStatus,
  type Actor,
  type ParsedReportBlock,
  type ReportInput,
  type ReportPreview,
  type ReportPreviewItem,
  type ReportResult,
} from '@tracker/shared';
import type { UserScope } from '../auth/scope';
import type { Db, StatusRow } from '../db/schema';
import { AppError } from '../errors';
import { chainHeldTickets } from './batchChain';
import { inTransaction, notify, type UserContext } from './context';
import {
  findTicketRef,
  loadTicketScope,
  ticketKeyOf,
  type TicketRef,
  type TicketScope,
} from './lookups';
import { reportMoveText } from './statusEvents';
import { enterStatus, eventEntry, writeTicket, type ActivityEntry } from './ticketWrites';

interface ResolvedBlock {
  block: ParsedReportBlock;
  scope: TicketScope | null;
  target: StatusRow | null;
}

const movesTo = (from: StatusRow, to: StatusRow): boolean =>
  to.id !== from.id && reportMayMove(from.category, to.category);

async function resolveBlock(
  db: Db,
  user: UserScope,
  block: ParsedReportBlock,
  ticketKey: string | undefined,
): Promise<ResolvedBlock> {
  const key = block.key ?? ticketKey;
  const ref = key ? await findTicketRef(db, user, key) : null;
  if (!ref) return { block, scope: null, target: null };
  const scope = await loadTicketScope(db, ref);
  const next = block.category ? resolveStatus(scope.statuses, block.category) : null;
  return { block, scope, target: next && movesTo(scope.status, next) ? next : null };
}

const previewItem = ({ block, scope, target }: ResolvedBlock): ReportPreviewItem => ({
  key: block.key,
  matched: scope !== null,
  ticketKey: scope ? ticketKeyOf(scope) : null,
  ticketTitle: scope?.ticket.title ?? null,
  fromStatusName: scope?.status.name ?? null,
  toStatusName: target?.name ?? null,
});

export async function previewReport(ctx: UserContext, input: ReportInput): Promise<ReportPreview> {
  const items: ReportPreviewItem[] = [];
  for (const block of parseReport(input.text)) {
    items.push(previewItem(await resolveBlock(ctx.db, ctx.scope, block, input.ticketKey)));
  }
  return { items, matchedCount: items.filter((item) => item.matched).length };
}

interface AppliedBlock {
  ref: TicketRef;
  heldDone: string[];
}

async function applyBlock(
  trx: Db,
  ctx: UserContext,
  actor: Actor,
  { block, scope, target }: ResolvedBlock & { scope: TicketScope },
): Promise<AppliedBlock> {
  const entries: ActivityEntry[] = [{ type: 'report', text: block.text }];
  if (target) entries.push(eventEntry(reportMoveText(target.name)));
  const changes = target ? await enterStatus(trx, actor, target) : {};
  const written = await writeTicket(trx, ctx.now, {
    ticket: scope.ticket,
    actor,
    changes,
    entries,
  });
  return { ref: { ticket: written.ticket, project: scope.project }, heldDone: written.heldDone };
}

function noMatch(ticketKey: string | undefined): AppError {
  const example = `${parseTicketKey(ticketKey ?? '')?.projectKey ?? 'KEY'}-1`;
  return new AppError(
    'no_match',
    `No matching ticket found. The report needs a line like “TICKET: ${example}”.`,
  );
}

export async function applyReport(
  ctx: UserContext,
  actor: Actor,
  input: ReportInput,
): Promise<ReportResult> {
  const applied = await inTransaction(ctx, async (trx) => {
    const blocks: AppliedBlock[] = [];
    for (const block of parseReport(input.text)) {
      // Resolved one at a time so a ticket named twice sees its own earlier change.
      const resolved = await resolveBlock(trx, ctx.scope, block, input.ticketKey);
      if (resolved.scope)
        blocks.push(await applyBlock(trx, ctx, actor, { ...resolved, scope: resolved.scope }));
    }
    if (blocks.length === 0) throw noMatch(input.ticketKey);
    return blocks;
  });
  const unique = new Map(applied.map(({ ref }) => [ref.ticket.id, ref]));
  for (const ref of unique.values()) notify(ctx, ref.project.id, ref.ticket.id);
  await chainHeldTickets(
    ctx,
    ctx.scope,
    applied.flatMap(({ heldDone }) => heldDone),
  );
  return { updatedTicketKeys: [...unique.values()].map(ticketKeyOf) };
}
