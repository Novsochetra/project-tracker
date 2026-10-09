import type { Db } from '../db/schema';
import { allStorageKeys } from '../repositories/attachments';
import { removeFiles, type FileStorage } from '../storage/fileStorage';

// An upload stores its file a moment before its row, so a file this old without a row was left
// behind: by a delete whose file storage refused to remove, or an upload cut off in between.
export const ORPHAN_AGE_MS = 60 * 60 * 1000;

// Lists every stored file; on S3 that needs s3:ListBucket (docs/s3-storage.md).
export async function removeOrphanFiles(
  deps: { db: Db; storage: FileStorage },
  now: number,
): Promise<number> {
  const known = new Set(await allStorageKeys(deps.db));
  const orphans: string[] = [];
  for await (const { key, modifiedAt } of deps.storage.list()) {
    if (!known.has(key) && modifiedAt < now - ORPHAN_AGE_MS) orphans.push(key);
  }
  return removeFiles(deps.storage, orphans);
}
