import { ACTIVE_RUN_STATUSES, CHAT_QUEUE_FULL, CHAT_QUEUE_MAX } from '@tracker/shared';
import { randomUUID } from 'node:crypto';
import type { UserScope } from '../../auth/scope';
import type { Db } from '../../db/schema';
import { conflict } from '../../errors';
import { insertQueued, queueSize } from '../../repositories/chatQueue';
import { latestChatRunRow } from '../../repositories/runs';
import { insertQuestion, saveChatChoice, type AskRequest } from '../askRuns';

export async function chatIsBusy(db: Db, scope: UserScope, chatId: string): Promise<boolean> {
  const run = await latestChatRunRow(db, scope, chatId);
  return ACTIVE_RUN_STATUSES.some((status) => status === run?.status);
}

// The message is saved as it is sent, files and all, so it outlives a reload or a helper restart.
// The caller holds the chat's lock (lockChat), so the count is the queue's own.
export async function queueMessage(trx: Db, request: AskRequest): Promise<void> {
  const { chat, queued, options } = request;
  const { count, next } = await queueSize(trx, chat.id);
  if (count >= CHAT_QUEUE_MAX) throw conflict(CHAT_QUEUE_FULL);
  const messageId = randomUUID();
  await insertQuestion(trx, request, messageId);
  await insertQueued(trx, {
    messageId,
    chatId: chat.id,
    runnerId: queued.runner.id,
    askModel: options.model,
    askMode: options.mode,
    askEffort: options.effort,
    position: next,
  });
  await saveChatChoice(trx, chat.id, queued, options);
}
