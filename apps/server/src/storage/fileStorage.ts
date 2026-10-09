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

export async function removeFiles(storage: FileStorage, keys: readonly string[]): Promise<void> {
  await Promise.all(keys.map((key) => storage.remove(key)));
}
