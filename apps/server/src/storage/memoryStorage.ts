import { checkedKey, type FileStorage } from './fileStorage';

export interface MemoryStorage extends FileStorage {
  readonly files: Map<string, Uint8Array>;
}

export function createMemoryStorage(): MemoryStorage {
  const files = new Map<string, Uint8Array>();
  const bytesOf = (key: string) => files.get(checkedKey(key));
  return {
    files,
    async write(key, body) {
      checkedKey(key);
      files.set(key, new Uint8Array(await new Response(body).arrayBuffer()));
    },
    read(key, range) {
      return Promise.resolve().then(() => {
        const bytes = bytesOf(key);
        const part = bytes && range ? bytes.subarray(range.start, range.end + 1) : bytes;
        return part ? new Blob([part]).stream() : null;
      });
    },
    stat(key) {
      return Promise.resolve().then(() => {
        const bytes = bytesOf(key);
        return bytes ? { size: bytes.byteLength } : null;
      });
    },
    remove(key) {
      return Promise.resolve().then(() => void files.delete(checkedKey(key)));
    },
  };
}
