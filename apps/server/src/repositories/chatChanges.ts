import type { ChatChangesRow } from '../db/chatChangeTables';
import type { Db } from '../db/schema';

// Each turn's send replaces the last: it holds every file the chat changed so far.
export async function saveChatChanges(db: Db, row: ChatChangesRow): Promise<void> {
  const { chatId: _chatId, ...rest } = row;
  await db
    .insertInto('chatChanges')
    .values(row)
    .onConflict((oc) => oc.column('chatId').doUpdateSet(rest))
    .execute();
}

export const findChatChanges = (db: Db, chatId: string) =>
  db.selectFrom('chatChanges').selectAll().where('chatId', '=', chatId).executeTakeFirst();
