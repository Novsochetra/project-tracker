import type { UserScope } from '../../auth/scope';
import { AppError, conflict } from '../../errors';
import { listMessageAttachmentRows } from '../../repositories/chatAttachments';
import {
  laterThan,
  lastMessageAt,
  leaveQueue,
  listQueuedRows,
  moveMessageTo,
  type QueuedRow,
} from '../../repositories/chatQueue';
import { findChatInScope, updateChatRow, type ChatWithKey } from '../../repositories/chats';
import { latestChatRunRow } from '../../repositories/runs';
import { askHistory } from '../askHistory';
import { queueAskRun } from '../askRuns';
import { chatPromptTicket } from '../chatTicket';
import { inTransaction, type ServiceContext } from '../context';
import { requireProject } from '../lookups';
import { notifyRun } from '../runMappers';
import { requireRunnerFor } from '../runners';

export const QUEUED_GONE = 'That message is no longer queued.';

// It runs as a follow-up asked now: the chat so far and its session are read as it starts.
export async function startQueued(
  ctx: ServiceContext,
  scope: UserScope,
  chat: ChatWithKey,
  row: QueuedRow,
): Promise<void> {
  const project = await requireProject(ctx.db, scope, chat.projectKey);
  const runner = await requireRunnerFor(ctx, scope, row.runnerId, project);
  const history = await askHistory(ctx.db, chat.id);
  const ticket = await chatPromptTicket(ctx.db, chat, project.key);
  const files = (await listMessageAttachmentRows(ctx.db, row.messageId)).map(
    (file) => file.fileName,
  );
  const now = laterThan(ctx.now(), await lastMessageAt(ctx.db, chat.id, false));
  const queued = { scope, runner, projectId: project.id, now };
  const options = { model: row.askModel, mode: row.askMode, effort: row.askEffort };
  const request = { queued, project, chat, history, ticket, question: row.text, options };
  const run = await inTransaction(ctx, async (trx) => {
    if (!(await leaveQueue(trx, row.messageId))) throw conflict(QUEUED_GONE);
    // It joins the thread after the answer it waited for.
    await moveMessageTo(trx, row.messageId, queued.now);
    await updateChatRow(trx, chat.id, { updatedAt: queued.now });
    return queueAskRun(trx, request, { id: row.messageId, files });
  });
  notifyRun(ctx, scope, run);
}

// A queue that can't start (its helper was removed, or another ask won) waits for Send now.
function unlessRefused(error: unknown): void {
  if (!(error instanceof AppError)) throw error;
}

// Only an answer that ended done goes on to the next message; a stopped or failed one holds them.
export async function startNextQueued(
  ctx: ServiceContext,
  scope: UserScope,
  chatId: string,
): Promise<void> {
  const latest = await latestChatRunRow(ctx.db, scope, chatId);
  if (latest?.status !== 'done') return;
  const [next] = await listQueuedRows(ctx.db, chatId);
  const chat = next && (await findChatInScope(ctx.db, scope, chatId, ctx.now()));
  if (next && chat) await startQueued(ctx, scope, chat, next).catch(unlessRefused);
}
