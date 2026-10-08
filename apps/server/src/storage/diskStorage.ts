import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import type { FileStorage } from './fileStorage';

const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function createDiskStorage(dir: string): FileStorage {
  const pathOf = (key: string): string => {
    if (!SAFE_KEY.test(key)) throw new Error(`Invalid storage key: ${key}`);
    return join(dir, key);
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
      const info = await stat(path).catch(() => null);
      if (!info?.isFile()) return null;
      const stream = createReadStream(path, range && { start: range.start, end: range.end });
      return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
    },
    async remove(key) {
      await rm(pathOf(key), { force: true });
    },
  };
}
