// Both ends inclusive, like an HTTP range.
export interface ByteRange {
  start: number;
  end: number;
}

export interface StoredFileInfo {
  size: number;
}

export interface FileStorage {
  // Stores the stream as it arrives. When the stream fails, nothing of it is kept.
  write(key: string, body: ReadableStream<Uint8Array>): Promise<void>;
  read(key: string, range?: ByteRange): Promise<ReadableStream<Uint8Array> | null>;
  stat(key: string): Promise<StoredFileInfo | null>;
  remove(key: string): Promise<void>;
}

// The server makes every key (`<id>.<extension>`), so anything else is a bug: refusing it keeps a
// key from reaching outside the uploads folder or the bucket's prefix.
const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function checkedKey(key: string): string {
  if (!SAFE_KEY.test(key)) throw new Error(`Invalid storage key: ${key}`);
  return key;
}

// Called once the rows are gone, so the files are no longer the tracker's: a delete has happened
// whatever storage says. One it won't remove is logged with its key for a person to remove: no
// server guesses later which stored files are whose (PT-133, docs/s3-storage.md).
export async function removeFiles(storage: FileStorage, keys: readonly string[]): Promise<number> {
  const results = await Promise.allSettled(keys.map((key) => storage.remove(key)));
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') return;
    const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
    console.warn(`File ${keys[index]} stays in storage and must be removed by hand: ${reason}`);
  });
  return results.filter((result) => result.status === 'fulfilled').length;
}
