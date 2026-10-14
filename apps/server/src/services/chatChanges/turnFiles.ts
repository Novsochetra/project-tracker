import { changesFolder, type ChatChangedFile } from '@tracker/shared';
import type { RunRow } from '../../db/runTables';
import type { Db } from '../../db/schema';
import { findChatChanges } from '../../repositories/chatChanges';
import { filesOf } from './chatChangesRows';

// The files are paths in one helper's folder, so another computer's turn starts the list again.
export async function chatFilesFor(db: Db, run: RunRow): Promise<ChatChangedFile[] | undefined> {
  if (run.kind !== 'ask' || run.chatId === null || !changesFolder(run.askMode)) return undefined;
  const changes = await findChatChanges(db, run.chatId);
  return changes && changes.runnerId === run.runnerId ? filesOf(changes) : [];
}
