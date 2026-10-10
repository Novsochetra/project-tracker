import { buildAskPrompt, type AskOptions, type ChatRole } from '@tracker/shared';
import { randomUUID } from 'node:crypto';
import type { ChatRow } from '../db/chatTables';
import type { Db, ProjectRow } from '../db/schema';
import { insertMessage, updateChatRow } from '../repositories/chats';
import { insertQueuedRun, queuedRunRow, type QueuedRun } from './runRows';

export const CHAT_BUSY = 'Claude is still answering. Wait for the answer or cancel it.';

export interface AskRequest {
  queued: QueuedRun;
  project: Pick<ProjectRow, 'key' | 'name'>;
  chat: Pick<ChatRow, 'id' | 'sessionId' | 'sessionRunnerId'>;
  history: readonly { role: ChatRole; text: string }[];
  question: string;
  options: AskOptions;
}

// A helper can resume only a session it made; any other gets the chat so far in the prompt.
const resumableSession = ({ chat, queued }: AskRequest): string | null =>
  chat.sessionId && chat.sessionRunnerId === queued.runner.id ? chat.sessionId : null;

export async function queueAsk(trx: Db, request: AskRequest) {
  const { queued, chat, question, options } = request;
  const resumeSessionId = resumableSession(request);
  const history = resumeSessionId ? [] : request.history;
  const prompt = buildAskPrompt({
    project: request.project,
    mode: options.mode,
    question,
    history,
  });
  const run = queuedRunRow(queued, {
    prompt,
    kind: 'ask',
    ticketId: null,
    chatId: chat.id,
    resumeSessionId,
    askModel: options.model,
    askMode: options.mode,
  });
  await insertQueuedRun(trx, run, CHAT_BUSY);
  await insertMessage(trx, {
    id: randomUUID(),
    chatId: chat.id,
    role: 'person',
    text: question,
    ticketId: null,
    runId: null,
    createdAt: queued.now,
  });
  // The chat keeps the last choice, so the next question starts with it.
  await updateChatRow(trx, chat.id, {
    updatedAt: queued.now,
    askModel: options.model,
    askMode: options.mode,
  });
  return run;
}
