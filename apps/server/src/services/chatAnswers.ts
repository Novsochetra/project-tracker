import { randomUUID } from 'node:crypto';
import { chatAnsweredPush } from '@tracker/shared';
import type { UserScope } from '../auth/scope';
import type { RunRow } from '../db/runTables';
import type { Db } from '../db/schema';
import { findChatInScope, insertMessage, updateChatRow } from '../repositories/chats';
import type { ServiceContext } from './context';
import { pushToUser } from './push';
import type { Answer } from './runEnding';

// The session belongs to the helper that answered, since Claude Code keeps it on that computer.
export async function saveAnswer(
  trx: Db,
  run: Pick<RunRow, 'id' | 'chatId' | 'runnerId'>,
  answer: Answer & { at: number },
): Promise<void> {
  if (!run.chatId) return;
  await insertMessage(trx, {
    id: randomUUID(),
    chatId: run.chatId,
    role: 'claude',
    text: answer.text,
    ticketId: null,
    runId: run.id,
    batchRunId: null,
    createdAt: answer.at,
  });
  const session = answer.sessionId
    ? { sessionId: answer.sessionId, sessionRunnerId: run.runnerId }
    : {};
  await updateChatRow(trx, run.chatId, { ...session, updatedAt: answer.at });
}

// Read after the answer is saved, so the push names the chat as it is now.
export function pushAnswer(
  ctx: ServiceContext,
  scope: UserScope,
  run: Pick<RunRow, 'chatId'>,
  answer: Answer,
): void {
  const { chatId } = run;
  if (!chatId) return;
  pushToUser(ctx, scope, async () => {
    const chat = await findChatInScope(ctx.db, scope, chatId, ctx.now());
    if (!chat) return null;
    return chatAnsweredPush(
      { projectKey: chat.projectKey, chatId, title: chat.title },
      answer.text,
    );
  });
}
