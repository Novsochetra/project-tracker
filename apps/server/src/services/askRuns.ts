import {
  buildAskPrompt,
  type AskHistoryMessage,
  type AskOptions,
  type PromptTicket,
} from '@tracker/shared';
import { randomUUID } from 'node:crypto';
import type { ChatRow } from '../db/chatTables';
import type { Db, ProjectRow } from '../db/schema';
import { insertMessage, updateChatRow } from '../repositories/chats';
import { sendChatFiles } from './chatFiles';
import { insertQueuedRun, queuedRunRow, type QueuedRun } from './runRows';

export const CHAT_BUSY = 'Claude is still answering. Wait for the answer or cancel it.';

export interface AskRunRequest {
  queued: QueuedRun;
  project: Pick<ProjectRow, 'key' | 'name' | 'instructions'>;
  chat: Pick<ChatRow, 'id' | 'sessionId' | 'sessionRunnerId'>;
  history: readonly AskHistoryMessage[];
  ticket: PromptTicket | null;
  question: string;
  options: AskOptions;
}

export interface AskRequest extends AskRunRequest {
  attachmentIds: readonly string[];
}

export interface SavedQuestion {
  id: string;
  files: readonly string[];
}

// A helper can resume only a session it made; any other gets the chat so far in the prompt.
const resumableSession = ({ chat, queued }: AskRunRequest): string | null =>
  chat.sessionId && chat.sessionRunnerId === queued.runner.id ? chat.sessionId : null;

export async function insertQuestion(trx: Db, request: AskRequest, id: string): Promise<string[]> {
  const { queued, chat, question } = request;
  await insertMessage(trx, {
    id,
    chatId: chat.id,
    role: 'person',
    text: question,
    ticketId: null,
    runId: null,
    batchRunId: null,
    createdAt: queued.now,
  });
  return sendChatFiles(trx, request.attachmentIds, { messageId: id, uploader: queued.scope });
}

// The chat keeps the last choice, so the next question starts with it.
export const saveChatChoice = (trx: Db, chatId: string, { now }: QueuedRun, options: AskOptions) =>
  updateChatRow(trx, chatId, {
    updatedAt: now,
    askModel: options.model,
    askMode: options.mode,
    askEffort: options.effort,
  });

// A chat still answering refuses the run, which rolls its transaction back.
export async function queueAskRun(trx: Db, request: AskRunRequest, saved: SavedQuestion) {
  const { queued, chat, question, options } = request;
  const resumeSessionId = resumableSession(request);
  const prompt = buildAskPrompt({
    project: request.project,
    mode: options.mode,
    question,
    files: saved.files,
    history: request.history,
    resumed: resumeSessionId !== null,
    ticket: request.ticket,
  });
  const run = queuedRunRow(queued, {
    prompt,
    kind: 'ask',
    ticketId: null,
    chatId: chat.id,
    resumeSessionId,
    askModel: options.model,
    askMode: options.mode,
    askEffort: options.effort,
    role: 'work',
    questionId: saved.id,
  });
  await insertQueuedRun(trx, run, CHAT_BUSY);
  return run;
}

// The run goes in last, so its prompt can name the files.
export async function queueAsk(trx: Db, request: AskRequest) {
  const id = randomUUID();
  const files = await insertQuestion(trx, request, id);
  const run = await queueAskRun(trx, request, { id, files });
  await saveChatChoice(trx, request.chat.id, request.queued, request.options);
  return run;
}
