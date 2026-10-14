import type { UserScope } from '../../auth/scope';
import type { RunnerRow, RunRow } from '../../db/runTables';
import { AppError } from '../../errors';
import { listMessageAttachmentRows } from '../../repositories/chatAttachments';
import {
  lastMessageAt,
  leaveQueue,
  moveMessageTo,
  type QueuedRow,
} from '../../repositories/chatQueue';
import { updateChatRow, type ChatWithKey } from '../../repositories/chats';
import { askHistory } from '../askHistory';
import { queueAskRun } from '../askRuns';
import { chatPromptTicket } from '../chatTicket';
import type { ServiceContext } from '../context';
import { requireProject } from '../lookups';
import { requireRunnerFor } from '../runners';

export const QUEUED_GONE = 'That message is no longer queued.';

// The answer it waited for was saved in this same millisecond, and the thread is in time order.
const laterThan = (now: number, last: number | null): number =>
  last === null ? now : Math.max(now, last + 1);

// A helper that was removed, or no longer runs the project, leaves the message for Send now.
export async function usableRunner(
  trx: ServiceContext,
  scope: UserScope,
  chat: ChatWithKey,
  row: QueuedRow,
): Promise<RunnerRow | null> {
  const project = { id: chat.projectId, key: chat.projectKey };
  return requireRunnerFor(trx, scope, row.runnerId, project).catch((error: unknown) => {
    if (error instanceof AppError) return null;
    throw error;
  });
}

// Inside the chat's lock, with the chat and the row read under it, so the run gets the text as
// last edited and the session the answer before it saved. It runs as a follow-up asked now.
export async function startQueuedIn(
  trx: ServiceContext,
  scope: UserScope,
  chat: ChatWithKey,
  { row, runner }: { row: QueuedRow; runner: RunnerRow },
): Promise<RunRow> {
  const project = await requireProject(trx.db, scope, chat.projectKey);
  const history = await askHistory(trx.db, chat.id);
  const ticket = await chatPromptTicket(trx.db, chat, project.key);
  const files = await listMessageAttachmentRows(trx.db, row.messageId);
  const now = laterThan(trx.now(), await lastMessageAt(trx.db, chat.id));
  await leaveQueue(trx.db, row.messageId);
  await moveMessageTo(trx.db, row.messageId, now);
  await updateChatRow(trx.db, chat.id, { updatedAt: now });
  const options = { model: row.askModel, mode: row.askMode, effort: row.askEffort };
  const queued = { scope, runner, projectId: project.id, now };
  const request = { queued, project, chat, history, ticket, question: row.text, options };
  return queueAskRun(trx.db, request, { id: row.messageId, files: files.map((f) => f.fileName) });
}
