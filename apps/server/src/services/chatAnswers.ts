import { randomUUID } from 'node:crypto';
import type { RunRow } from '../db/runTables';
import type { Db } from '../db/schema';
import { insertMessage, updateChatRow } from '../repositories/chats';
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
    createdAt: answer.at,
  });
  const session = answer.sessionId
    ? { sessionId: answer.sessionId, sessionRunnerId: run.runnerId }
    : {};
  await updateChatRow(trx, run.chatId, { ...session, updatedAt: answer.at });
}
