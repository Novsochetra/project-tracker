// Both ends inclusive, like an HTTP range.
export interface ByteRange {
  start: number;
  end: number;
}

export interface FileStorage {
  // Stores the stream as it arrives. When the stream fails, nothing of it is kept.
  write(key: string, body: ReadableStream<Uint8Array>): Promise<void>;
  read(key: string, range?: ByteRange): Promise<ReadableStream<Uint8Array> | null>;
  remove(key: string): Promise<void>;
}

export async function removeFiles(storage: FileStorage, keys: readonly string[]): Promise<void> {
  await Promise.all(keys.map((key) => storage.remove(key)));
}
