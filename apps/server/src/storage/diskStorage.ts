import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { checkedKey, type FileStorage } from './fileStorage';

export function createDiskStorage(dir: string): FileStorage {
  const pathOf = (key: string): string => join(dir, checkedKey(key));
  const fileAt = async (path: string) => {
    const info = await stat(path).catch(() => null);
    return info?.isFile() ? info : null;
  };
  return {
    async write(key, body) {
      const path = pathOf(key);
      await mkdir(dir, { recursive: true });
      try {
        await writeFile(path, body);
      } catch (error) {
        await rm(path, { force: true });
        throw error;
      }
    },
    async read(key, range) {
      const path = pathOf(key);
      if (!(await fileAt(path))) return null;
      const stream = createReadStream(path, range && { start: range.start, end: range.end });
      return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
    },
    async stat(key) {
      const info = await fileAt(pathOf(key));
      return info && { size: info.size };
    },
    async remove(key) {
      await rm(pathOf(key), { force: true });
    },
  };
}
