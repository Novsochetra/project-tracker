import type { FileStorage } from './fileStorage';

export interface MemoryStorage extends FileStorage {
  readonly files: Map<string, Uint8Array>;
}

export function createMemoryStorage(): MemoryStorage {
  const files = new Map<string, Uint8Array>();
  return {
    files,
    async write(key, body) {
      files.set(key, new Uint8Array(await new Response(body).arrayBuffer()));
    },
    read(key, range) {
      const bytes = files.get(key);
      const part = bytes && range ? bytes.subarray(range.start, range.end + 1) : bytes;
      return Promise.resolve(part ? new Blob([part]).stream() : null);
    },
    remove(key) {
      files.delete(key);
      return Promise.resolve();
    },
  };
}
