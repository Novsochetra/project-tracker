import { randomUUID } from 'node:crypto';
import { CHAT_ANSWER_IMAGE_TYPES } from '@tracker/shared';
import type { UserScope } from '../auth/scope';
import type { RunRow } from '../db/runTables';
import type { Db } from '../db/schema';
import { linkChatAttachments } from '../repositories/chatAttachments';
import { insertMessage, updateChatRow } from '../repositories/chats';
import type { Answer } from './runEnding';

// Pictures that can't be linked (another user's, or already sent) are left out rather than lose
// the answer, which a refused end would. Only types stored without metadata show (PT-225).
const linkPictures = (trx: Db, uploader: UserScope, messageId: string, ids: readonly string[]) =>
  linkChatAttachments(trx, [...new Set(ids)], { messageId, uploader }, CHAT_ANSWER_IMAGE_TYPES);

// The session belongs to the helper that answered, since Claude Code keeps it on that computer.
export async function saveAnswer(
  trx: Db,
  uploader: UserScope,
  run: Pick<RunRow, 'id' | 'chatId' | 'runnerId'>,
  answer: Answer & { at: number },
): Promise<void> {
  if (!run.chatId) return;
  const messageId = randomUUID();
  await insertMessage(trx, {
    id: messageId,
    chatId: run.chatId,
    role: 'claude',
    text: answer.text,
    ticketId: null,
    runId: run.id,
    batchRunId: null,
    createdAt: answer.at,
  });
  await linkPictures(trx, uploader, messageId, answer.attachmentIds);
  const session = answer.sessionId
    ? { sessionId: answer.sessionId, sessionRunnerId: run.runnerId }
    : {};
  await updateChatRow(trx, run.chatId, { ...session, updatedAt: answer.at });
}
