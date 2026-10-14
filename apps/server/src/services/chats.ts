import { randomUUID } from 'node:crypto';
import {
  chosenAskOptions,
  type askInput,
  type Chat,
  type ChatDetail,
  type startChatInput,
} from '@tracker/shared';
import type { z } from 'zod';
import type { UserScope } from '../auth/scope';
import type { ChatRow } from '../db/chatTables';
import type { ProjectRow } from '../db/schema';
import { notFound } from '../errors';
import { listCardTicketRows } from '../repositories/chatCardTickets';
import {
  findChatInScope,
  insertChat,
  listMessageRows,
  listProjectChatRows,
  type ChatWithKey,
} from '../repositories/chats';
import { listQueuedRows, lockChat } from '../repositories/chatQueue';
import { latestChatRunRow, listStoppedChatRunRows } from '../repositories/runs';
import { askHistory } from './askHistory';
import { queueAsk } from './askRuns';
import { chatContextOf } from './chatContext';
import { sendOrQueue } from './chatQueue/sendOrQueue';
import { chatFilesByMessage } from './chatFiles';
import { chatTitle, toChat, toMessage, toQueuedMessage } from './chatMappers';
import { chatPromptTicket, requireChatTicket } from './chatTicket';
import { inTransaction, type ServiceContext } from './context';
import { requireProject } from './lookups';
import { notifyRun, toRun } from './runMappers';
import { requireRunnerFor } from './runners';
import { expireSilentRuns } from './runs';

type AskValues = z.output<typeof askInput>;
type StartValues = z.output<typeof startChatInput>;

const CHATS_SHOWN = 50;

// 404 rather than 403, so nobody learns another user's chat exists.
export async function requireChat(
  ctx: ServiceContext,
  scope: UserScope,
  id: string,
): Promise<ChatWithKey> {
  const row = await findChatInScope(ctx.db, scope, id, ctx.now());
  if (!row) throw notFound('That chat was not found.');
  return row;
}

export async function listChats(
  ctx: ServiceContext,
  scope: UserScope,
  projectKey: string,
): Promise<Chat[]> {
  const project = await requireProject(ctx.db, scope, projectKey);
  const rows = await listProjectChatRows(ctx.db, scope, project.id, {
    limit: CHATS_SHOWN,
    now: ctx.now(),
  });
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
  const files = await chatFilesByMessage(ctx.db, chat.id);
  const cards = await listCardTicketRows(ctx.db, chat.id);
  const run = await latestChatRunRow(ctx.db, scope, chat.id);
  const stopped = await listStoppedChatRunRows(ctx.db, scope, chat.id);
  const context = await chatContextOf(ctx.db, chat.id);
  const queued = await listQueuedRows(ctx.db, chat.id);
  const filesOf = (id: string) => files.get(id) ?? [];
  return {
    chat: toChat(chat),
    messages: messages.map((message) => toMessage(message, cards, filesOf(message.id))),
    run: run ? toRun(run) : null,
    stoppedRuns: stopped.map(toRun),
    ...(context ? { context } : {}),
    queued: queued.map((row) => toQueuedMessage(row, filesOf(row.messageId))),
  };
}

interface AskIn {
  project: ProjectRow;
  chat: ChatRow;
  isNew: boolean;
}

// Only the server adds a plan (planFollowUp.ts): the route's zod input has no such field.
export type AskWithPlan = AskValues & { plan?: string };

// Under the chat's lock, so the session and the chat so far are as the answer before left them.
async function askRequestIn(trx: ServiceContext, scope: UserScope, at: AskIn, input: AskWithPlan) {
  const { project, isNew } = at;
  const chat = isNew ? at.chat : await requireChat(trx, scope, at.chat.id);
  const runner = await requireRunnerFor(trx, scope, input.runnerId, project);
  const history = isNew ? [] : await askHistory(trx.db, chat.id);
  const ticket = await chatPromptTicket(trx.db, chat, project.key);
  const queued = { scope, runner, projectId: project.id, now: trx.now() };
  const saved = { model: chat.askModel, mode: chat.askMode, effort: chat.askEffort };
  const options = chosenAskOptions(input, saved);
  const { text: question, attachmentIds, plan } = input;
  return { queued, project, chat, history, ticket, question, attachmentIds, options, plan };
}

async function askIn(
  ctx: ServiceContext,
  scope: UserScope,
  at: AskIn,
  input: AskWithPlan,
): Promise<ChatDetail> {
  await requireRunnerFor(ctx, scope, input.runnerId, at.project);
  await expireSilentRuns(ctx);
  const runs = await inTransaction(ctx, async (db) => {
    if (at.isNew) await insertChat(db, at.chat);
    else await lockChat(db, at.chat.id);
    const trx = { ...ctx, db };
    const request = await askRequestIn(trx, scope, at, input);
    // An approved plan goes ahead of messages sent while Claude planned: the queue keeps no plan.
    const goesNow = at.isNew || request.plan !== undefined;
    return goesNow ? [await queueAsk(db, request)] : sendOrQueue(trx, scope, request);
  });
  for (const run of runs) notifyRun(ctx, scope, run);
  return getChat(ctx, scope, at.chat.id);
}

export async function startChat(
  ctx: ServiceContext,
  scope: UserScope,
  projectKey: string,
  input: StartValues,
): Promise<ChatDetail> {
  const project = await requireProject(ctx.db, scope, projectKey);
  const ticket = input.ticketKey ? await requireChatTicket(ctx.db, project, input.ticketKey) : null;
  const at = ctx.now();
  const options = chosenAskOptions(input);
  const chat: ChatRow = {
    id: randomUUID(),
    userId: scope,
    projectId: project.id,
    title: chatTitle(input.text),
    sessionId: null,
    sessionRunnerId: null,
    askModel: options.model,
    askMode: options.mode,
    askEffort: options.effort,
    ticketId: ticket?.id ?? null,
    createdAt: at,
    updatedAt: at,
  };
  return askIn(ctx, scope, { project, chat, isNew: true }, input);
}

export async function askInChat(
  ctx: ServiceContext,
  scope: UserScope,
  chatId: string,
  input: AskWithPlan,
): Promise<ChatDetail> {
  const chat = await requireChat(ctx, scope, chatId);
  const project = await requireProject(ctx.db, scope, chat.projectKey);
  return askIn(ctx, scope, { project, chat, isNew: false }, input);
}
