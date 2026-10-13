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

export interface AskRequest {
  queued: QueuedRun;
  project: Pick<ProjectRow, 'key' | 'name' | 'instructions'>;
  chat: Pick<ChatRow, 'id' | 'sessionId' | 'sessionRunnerId'>;
  history: readonly AskHistoryMessage[];
  ticket: PromptTicket | null;
  question: string;
  attachmentIds: readonly string[];
  options: AskOptions;
}

// A helper can resume only a session it made; any other gets the chat so far in the prompt.
const resumableSession = ({ chat, queued }: AskRequest): string | null =>
  chat.sessionId && chat.sessionRunnerId === queued.runner.id ? chat.sessionId : null;

async function insertQuestion(trx: Db, request: AskRequest, id: string): Promise<string[]> {
  const { queued, chat, question } = request;
  await insertMessage(trx, {
    id,
    chatId: chat.id,
    role: 'person',
    text: question,
    ticketId: null,
    runId: null,
    createdAt: queued.now,
  });
  return sendChatFiles(trx, request.attachmentIds, { messageId: id, uploader: queued.scope });
}

// The run goes in last, so its prompt can name the files; a chat still answering refuses it
// there, which rolls the question back too.
export async function queueAsk(trx: Db, request: AskRequest) {
  const { queued, chat, question, options } = request;
  const questionId = randomUUID();
  const files = await insertQuestion(trx, request, questionId);
  const resumeSessionId = resumableSession(request);
  const prompt = buildAskPrompt({
    project: request.project,
    mode: options.mode,
    question,
    files,
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
    questionId,
  });
  await insertQueuedRun(trx, run, CHAT_BUSY);
  // The chat keeps the last choice, so the next question starts with it.
  await updateChatRow(trx, chat.id, {
    updatedAt: queued.now,
    askModel: options.model,
    askMode: options.mode,
    askEffort: options.effort,
  });
  return run;
}
