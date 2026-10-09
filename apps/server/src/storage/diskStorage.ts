import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { checkedKey, isStorageKey, type FileStorage } from './fileStorage';

// A file arrives under a partial name and takes its key only once whole. A stop can cut an upload
// and exit before its handler removes what came, so partial files go when storage opens. No key
// starts with a dot (checkedKey), so the names never meet.
const partialName = (key: string): string => `.${randomUUID()}-${key}.partial`;
const isPartial = (name: string): boolean => name.startsWith('.') && name.endsWith('.partial');

export async function removePartialFiles(dir: string): Promise<void> {
  const names = await readdir(dir).catch(() => []);
  await Promise.all(names.filter(isPartial).map((name) => rm(join(dir, name), { force: true })));
}

export function createDiskStorage(dir: string): FileStorage {
  const pathOf = (key: string): string => join(dir, checkedKey(key));
  const fileAt = async (path: string) => {
    const info = await stat(path).catch(() => null);
    return info?.isFile() ? info : null;
  };
  return {
    async write(key, body) {
      const path = pathOf(key);
      const partial = join(dir, partialName(key));
      await mkdir(dir, { recursive: true });
      try {
        await writeFile(partial, body);
        await rename(partial, path);
      } catch (error) {
        await rm(partial, { force: true });
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
    async *list() {
      const names = await readdir(dir).catch(() => []);
      for (const key of names.filter(isStorageKey)) {
        const info = await fileAt(join(dir, key));
        if (info) yield { key, modifiedAt: info.mtimeMs };
      }
    },
  };
}
