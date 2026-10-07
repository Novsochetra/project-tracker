export interface FileStorage {
  write(key: string, bytes: Uint8Array): Promise<void>;
  read(key: string): Promise<ReadableStream<Uint8Array> | null>;
  remove(key: string): Promise<void>;
}

export async function removeFiles(storage: FileStorage, keys: readonly string[]): Promise<void> {
  await Promise.all(keys.map((key) => storage.remove(key)));
}
