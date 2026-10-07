import type { FileStorage } from './fileStorage';

export interface MemoryStorage extends FileStorage {
  readonly files: Map<string, Uint8Array>;
}

export function createMemoryStorage(): MemoryStorage {
  const files = new Map<string, Uint8Array>();
  return {
    files,
    write(key, bytes) {
      files.set(key, bytes.slice());
      return Promise.resolve();
    },
    read(key) {
      const bytes = files.get(key);
      return Promise.resolve(bytes ? new Blob([bytes]).stream() : null);
    },
    remove(key) {
      files.delete(key);
      return Promise.resolve();
    },
  };
}
