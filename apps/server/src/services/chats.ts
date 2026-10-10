import { randomUUID } from 'node:crypto';
import type { askInput, Chat, ChatDetail } from '@tracker/shared';
import type { z } from 'zod';
import type { UserScope } from '../auth/scope';
import type { ChatRow } from '../db/chatTables';
import type { ProjectRow } from '../db/schema';
import { notFound } from '../errors';
import {
  findChatInScope,
  insertChat,
  listMessageRows,
  listProjectChatRows,
  type ChatWithKey,
} from '../repositories/chats';
import { latestChatRunRow } from '../repositories/runs';
import { queueAsk } from './askRuns';
import { chatTitle, toChat, toMessage } from './chatMappers';
import { inTransaction, type ServiceContext } from './context';
import { requireProject } from './lookups';
import { notifyRun, toRun } from './runMappers';
import { requireRunnerFor } from './runners';
import { expireSilentRuns } from './runs';

type AskValues = z.output<typeof askInput>;

const CHATS_SHOWN = 50;

// 404 rather than 403, so nobody learns another user's chat exists.
export async function requireChat(
  ctx: ServiceContext,
  scope: UserScope,
  id: string,
): Promise<ChatWithKey> {
  const row = await findChatInScope(ctx.db, scope, id);
  if (!row) throw notFound('That chat was not found.');
  return row;
}

export async function listChats(
  ctx: ServiceContext,
  scope: UserScope,
  projectKey: string,
): Promise<Chat[]> {
  const project = await requireProject(ctx.db, projectKey);
  const rows = await listProjectChatRows(ctx.db, scope, project.id, CHATS_SHOWN);
  return rows.map(toChat);
}

export async function getChat(
  ctx: ServiceContext,
  scope: UserScope,
  id: string,
): Promise<ChatDetail> {
  await expireSilentRuns(ctx);
  const chat = await requireChat(ctx, scope, id);
  const messages = await listMessageRows(ctx.db, chat.id);
  const run = await latestChatRunRow(ctx.db, scope, chat.id);
  return { chat: toChat(chat), messages: messages.map(toMessage), run: run ? toRun(run) : null };
}

interface AskIn {
  project: ProjectRow;
  chat: ChatRow;
  isNew: boolean;
}

async function askIn(
  ctx: ServiceContext,
  scope: UserScope,
  { project, chat, isNew }: AskIn,
  input: AskValues,
): Promise<ChatDetail> {
  const runner = await requireRunnerFor(ctx, scope, input.runnerId, project);
  await expireSilentRuns(ctx);
  const history = isNew ? [] : await listMessageRows(ctx.db, chat.id);
  const queued = { scope, runner, projectId: project.id, now: ctx.now() };
  const run = await inTransaction(ctx, async (trx) => {
    if (isNew) await insertChat(trx, chat);
    const options = { model: input.model, mode: input.mode };
    return queueAsk(trx, { queued, project, chat, history, question: input.text, options });
  });
  notifyRun(ctx, scope, run);
  return getChat(ctx, scope, chat.id);
}

export async function startChat(
  ctx: ServiceContext,
  scope: UserScope,
  projectKey: string,
  input: AskValues,
): Promise<ChatDetail> {
  const project = await requireProject(ctx.db, projectKey);
  const at = ctx.now();
  const chat: ChatRow = {
    id: randomUUID(),
    userId: scope,
    projectId: project.id,
    title: chatTitle(input.text),
    sessionId: null,
    sessionRunnerId: null,
    askModel: input.model,
    askMode: input.mode,
    createdAt: at,
    updatedAt: at,
  };
  return askIn(ctx, scope, { project, chat, isNew: true }, input);
}

export async function askInChat(
  ctx: ServiceContext,
  scope: UserScope,
  chatId: string,
  input: AskValues,
): Promise<ChatDetail> {
  const chat = await requireChat(ctx, scope, chatId);
  const project = await requireProject(ctx.db, chat.projectKey);
  return askIn(ctx, scope, { project, chat, isNew: false }, input);
}
