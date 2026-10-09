// Both ends inclusive, like an HTTP range.
export interface ByteRange {
  start: number;
  end: number;
}

export interface StoredFileInfo {
  size: number;
}

export interface StoredEntry {
  key: string;
  // When it was last written, in ms.
  modifiedAt: number;
}

export interface FileStorage {
  // Stores the stream as it arrives. When the stream fails, nothing of it is kept.
  write(key: string, body: ReadableStream<Uint8Array>): Promise<void>;
  read(key: string, range?: ByteRange): Promise<ReadableStream<Uint8Array> | null>;
  stat(key: string): Promise<StoredFileInfo | null>;
  remove(key: string): Promise<void>;
  // Every file it keeps under a key it could have made.
  list(): AsyncIterable<StoredEntry>;
}

// The server makes every key (`<id>.<extension>`), so anything else is a bug: refusing it keeps a
// key from reaching outside the uploads folder or the bucket's prefix.
const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export const isStorageKey = (key: string): boolean => SAFE_KEY.test(key);

export function checkedKey(key: string): string {
  if (!isStorageKey(key)) throw new Error(`Invalid storage key: ${key}`);
  return key;
}

// Called once the rows are gone, so the files are no longer the tracker's: a delete has happened
// whatever storage says. One it won't remove is logged and left to removeOrphanFiles.
export async function removeFiles(storage: FileStorage, keys: readonly string[]): Promise<number> {
  const results = await Promise.allSettled(keys.map((key) => storage.remove(key)));
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') return;
    const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
    console.warn(`File ${keys[index]} stays until the next clean-up: ${reason}`);
  });
  return results.filter((result) => result.status === 'fulfilled').length;
}
